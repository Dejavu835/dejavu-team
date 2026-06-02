# 技能五子棋 架构笔记

> 任务：基于现有 `wuziqi/index.html`（912 行单文件）扩展为"技能五子棋"模式
> 目标：单 html 文件，60fps，可玩
> 阅读时间：2026-06-02

---

## 1. 现有 wuziqi/index.html 模块清单

文件结构：HTML（160 行）+ CSS（90 行）+ JS（660 行）= 912 行单文件

### 1.1 Game 状态机（第 245-280 行，~35 行）

| 项 | 详情 |
|---|---|
| 位置 | `const Game = (()=>{...})()` |
| 功能 | 状态存储、落子、胜负判断、悔棋、历史 |
| 关键 API | `reset(sz)`、`move(r,c)`、`undo(n)`、`checkWin(brd,r,c,col)` |
| 数据 | `st = {size, board, cur, winner, winLine, moves, hist, startAt}` |
| 复用度 | **95% 复用** |
| 改动点 | 增加 `st.skills = {cd:{}, energy:0}`；`move()` 增加 effect 钩子（如"消子"会改 board 后再判胜负） |

### 1.2 AI 引擎（第 282-688 行，~406 行）

| 项 | 详情 |
|---|---|
| 位置 | `const AI = (()=>{...})()` |
| 功能 | 形状评分、alpha-beta 搜索、VCF 必杀、qsearch、开局库、迭代加深、killer 启发 |
| 关键 API | `getBestMove(brd, sz, my, diff, deadline)` |
| 核心评估 | `shapeScore(line, col, opp)`：连五/活四/冲四/活三/眠三/活二/眠二/单子 |
| 难度梯度 | easy=depth 2（100ms）/ mid=depth 4（400ms）/ hard=depth 6（1500ms）/ nightmare=depth 8（3000ms）|
| 复用度 | **80% 复用** |
| 改动点 | ① `getBestMove` 增加"选技能"分支（基于 skillScore + 概率采样）② 增加"模拟技能效果"工具函数 `simulateSkillEffect()` ③ `evalBoard` 增加"技能战略价值"项 |

### 1.3 Board 渲染（第 690-790 行，~100 行）

| 项 | 详情 |
|---|---|
| 位置 | `const Board = (()=>{...})()` |
| 功能 | Canvas 自适应 DPR、鼠标/触摸交互、棋子绘制、hover/最后手/胜线高亮 |
| 关键 API | `init(el,op)`、`setStone(r,c,col)`、`setWinningLine(l)`、`setHover(p)`、`draw()` |
| 复用度 | **90% 复用**（不改 Canvas 本身） |
| 改动点 | 增加"技能效果层" overlay：粒子/光环/迷雾，每次 draw 末尾叠加在 Board 之上 |

### 1.4 UI 侧栏（第 792-820 行，~28 行）

| 项 | 详情 |
|---|---|
| 位置 | `const UI = (()=>{...})()` |
| 功能 | 模式/难度/先手/主题切换、悔棋/提示/新对局、记录显示、横幅 |
| 复用度 | **70% 复用** |
| 改动点 | 增加"技能栏"卡（顶部）+ "技能说明" modal + 能量条组件 |

### 1.5 Main 入口（第 822-912 行，~90 行）

| 项 | 详情 |
|---|---|
| 位置 | `(function(){...})()` |
| 功能 | 串联各模块、状态机管理、AI 思考防重入、全屏切换 |
| 复用度 | **50% 重写** |
| 改动点 | ① 增加 mode='skill' 模式分支 ② 增加技能使用后的"效果应用"流程 ③ 回合管理要支持"技能用完不算一回合"或"算一回合"（看规则） ④ 增加 `SkillState` 单例 |

---

## 2. 技能系统架构笔记

### 2.1 技能数据存储

```js
const Skills = (()=>{
  const SKILLS = [
    { id:'shield',   name:'护盾',    icon:'🛡', cd:5, cost:30, type:'defense',
      effect: ctx => { ctx.def.shield = true },
      onExpire: ctx => { ctx.def.shield = false } },
    { id:'mist',     name:'迷雾',    icon:'🌫', cd:3, cost:20, type:'disrupt',
      effect: ctx => { ctx.atk.fog = 3 } },
    // ... 共 6-10 个
  ]
  return { list: SKILLS }
})()
```

- 单例 `Skills`（不实例化）
- 每技能：`{id, name, icon, cd, cost, type, effect, onExpire, aiWeight}`
- 玩家状态：`playerState = { cd:{}, energy:0, buffs:{}, debuffs:{} }`
- AI 状态独立（每方一份）

### 2.2 技能使用流程

```
玩家回合
  ↓
点棋盘（落子）或点技能按钮（用技能）
  ↓
[落子路径] Game.move → checkWin → 切回合
[技能路径] SkillMgr.cast(id)
  ├── 1. 检查 cd（>0 则拒绝 + 红字提示）
  ├── 2. 扣 cost（energy -= cost，不够则拒绝）
  ├── 3. 应用 effect（改 playerState 或 board）
  ├── 4. 注册 onExpire 计时（毫秒或回合数）
  ├── 5. 设置 cd[id] = maxCd
  ├── 6. 触发 AI 响应（或不算回合，看规则）
  ↓
回合切换（看规则是否消耗回合）
  ↓
对手回合（AI 用技能 → 同上）
```

### 2.3 技能效果实现：在 Board/Game 上改 vs 引入 SkillLayer

**选择：直接改 Board/Game 状态 + EffectOverlay**

理由：
- 现有 Game.move 已经接受 effect 钩子；技能 effect 多为"瞬间改 board"（消子/换位）
- 持续型效果（迷雾/护盾）用 playerState 标志位 + 渲染时叠加 overlay
- 不引入中间层，减少心智负担

```js
// 例：消子技能
{ id:'erase', effect: ctx => {
    if(ctx.target) {
      Game.board[ctx.target.r][ctx.target.c] = E
      Board.removeStone(ctx.target.r, ctx.target.c)
    }
}}
```

### 2.4 技能动画/视觉反馈（60fps 目标）

- **rAF 主循环**：跟现有 Game 同步
- **效果层**：Board.draw() 末尾追加 effectLayer.draw(ctx)
- **粒子数限制**：单次释放最多 30 个粒子，TTL 500ms
- **实现方式**：Canvas 内独立 `particles[]` 数组 + 每帧 update/draw
- **CD 数字**：CSS `transition` 实现 0 → maxCd 平滑；不引 rAF

```js
// 粒子示例
function spawnParticles(x, y, color, count=20) {
  for(let i=0; i<count; i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*4,
      vy: (Math.random()-0.5)*4,
      life: 500, color, size: 2+Math.random()*2
    })
  }
}
```

### 2.5 技能 AI 怎么选

**简化方案（推荐 v1）**：基于"局面评估 + 技能权重"的贪心 + 概率采样

```js
function aiChooseSkill(state, brd, sz, my) {
  const candidates = Skills.list.filter(s => s.cdReady(state.cd[s.id]))
  if(!candidates.length) return null

  // 评估每个技能的"战略价值"
  const scored = candidates.map(s => ({
    skill: s,
    score: evaluateSkillValue(s, state, brd, sz, my)
  }))

  // 按概率采样（不是 argmax，增加人味）
  scored.sort((a,b) => b.score - a.score)
  const top3 = scored.slice(0, 3)
  return weightedPick(top3)  // 60% 给最高分，40% 给次高分
}
```

**进阶方案（v2）**：在 alpha-beta 搜索中，根节点扩展为"落子 OR 用技能"，分支因子从 225 → 225+6=231。深度限制要降到 4 避免超时。

**推荐 v1 走简化方案**：易实现、好调参、玩家体验"AI 偶尔犯傻但很合理"。

---

## 3. 单 html 文件结构建议

### 3.1 文件分段（总 ~2000 行）

| 段 | 行数 | 内容 |
|---|---|---|
| HTML 头 | 1-10 | DOCTYPE、meta、title、favicon |
| CSS | 11-180 | 顶栏、棋盘、侧栏、技能栏、能量条、动画、横幅、响应式 |
| HTML body | 181-360 | 顶栏、模式选择、棋盘、侧栏（信息/操作/技能栏/主题/记录）、横幅、规则 |
| JS: Game | 361-400 | 状态机 + 技能 effect 钩子 |
| JS: Skills | 401-450 | 技能数据 + SkillMgr |
| JS: AI | 451-900 | 复用 wuziqi AI + 选技能 + 效果模拟 |
| JS: Board | 901-1050 | 复用 wuziqi Board + EffectLayer |
| JS: UI | 1051-1180 | 侧栏 + 技能栏控件 + 能量条更新 |
| JS: Particles | 1181-1240 | 粒子系统 |
| JS: Main | 1241-1450 | 入口、模式分支、回合管理 |
| 测试/调试钩子 | 1451-1500 | window.SkillDebug、window.GameDebug |

### 3.2 LOC 估算

- 基础复用：~700 行（Game/AI/Board/UI 大部分）
- 新增技能系统：~800-1000 行（Skills/SkillMgr/AI 选技能/效果层/粒子/UI 控件/Main 改写）
- 适配 + 测试：~200 行
- **总计：~1800-2200 行**

### 3.3 实施工时（按 8 小时满负荷）

- 技能数据设计 + UI：1.5h
- SkillMgr + Main 改写：2h
- 视觉效果（粒子/能量条/CD）：1.5h
- AI 选技能：1.5h
- 测试 + 调平衡：1.5h
- 合计 8h（不含市场调查和规则拍板）

---

## 4. 实施风险清单（5 大）

| # | 风险 | 影响 | 缓解方案 |
|---|---|---|---|
| 1 | **VCF 搜索树爆炸**：技能组合让 AI 决策分支从 225 → 225+6=231，深度 8 时算不动 | AI 超时 | v1 走"独立选技能"（不在 minimax 内扩展），v2 再做 minimax 内 |
| 2 | **技能动画掉帧**：粒子 / 光环 / 迷雾叠加导致每帧 16ms 内画不完 | 玩家体验卡 | 粒子数 ≤ 30/技能，迷雾用 fillRect 半透明不用 blur，rAF 而非 setInterval |
| 3 | **AI 用技能频率失控**：贪心算法让 AI 每回合都用技能 | 游戏失衡 | 技能权重 + 概率采样（不是 argmax），easy 30% 用 / mid 50% / hard 75% |
| 4 | **玩家信息超载**：30 秒看不懂技能说明 | 留存差 | 第一局固定提示 3 个核心技能 + 主菜单加 30 秒教程动画（可跳过） |
| 5 | **状态同步 bug**：技能异步 effect 跟回合切换冲突 | 游戏崩 | 技能 effect 全同步（不 await），效果立即应用、动画 500ms 内完成才切回合 |

---

## 5. 给老板的快速决策清单

需要老板拍板的 5 件事：

1. **资源系统**：纯 CD / 能量条 / 混合（推荐混合）
2. **技能数量**：6 / 8 / 10（推荐 8）
3. **技能类型分布**：攻击/防御/干扰/资源/特殊 各几个
4. **AI 用技能概率梯度**：easy 30% / mid 50% / hard 75% / nightmare 90%
5. **回合定义**：用技能算 1 回合 vs 不算（影响游戏节奏）

---

## 6. 附：现有 wuziqi 已知能力（必须继承）

- ✅ 15×15 标准棋盘
- ✅ VCF 必杀搜索
- ✅ alpha-beta 剪枝（深度 2-8）
- ✅ qsearch 静态搜索
- ✅ 4 难度梯度（easy/mid/hard/nightmare）
- ✅ 开局库（hard+ 用）
- ✅ 主题切换（木纹/玉石/极简）
- ✅ 悔棋/提示
- ✅ 移动端触摸
- ✅ 全屏
- ✅ 计时
- ✅ 落子记录
- ✅ 胜利横幅
- ❌ 没有技能（要加）
- ❌ 没有能量条（要加）
