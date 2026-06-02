# dejavu team · /next/ — Design Spec

> 实验性 MiniMax-style 团队主页 · 部署到 `dejavuagent.cn/next/`
> 复刻自 MiniMax.io 视觉骨架，内容为 dejavu team 量身改造。

---

## 1. 视觉系统（Design Tokens）

### 1.1 配色

```css
--bg-base:        #E8E3DC;   /* 暖米灰主背景 */
--bg-grad-top:    #EFEAE3;   /* 渐变上 */
--bg-grad-bot:    #D5CFC6;   /* 渐变下 */
--bg-soft:        #F4F0EA;   /* 卡片浅色 */
--ink-primary:    #1A1A1A;   /* 主文字 */
--ink-secondary:  #6B6660;   /* 副文字 */
--ink-muted:      #9A958D;   /* 弱化文字/页脚 */
--accent:         #E94E5B;   /* 珊瑚红强调（logo / 下划线） */
--accent-soft:    #F4B5BB;   /* 珊瑚红淡 */
--btn-primary-bg: #0F0F0F;   /* 主按钮背景（近黑） */
--btn-primary-fg: #FFFFFF;   /* 主按钮文字 */
--line-soft:      rgba(26,26,26,0.08); /* 分隔线 */
--shadow-card:    0 8px 32px rgba(26,26,26,0.06);
--shadow-hover:   0 12px 40px rgba(26,26,26,0.12);
```

### 1.2 字体

```css
--font-sans: 'Inter', 'Plus Jakarta Sans', -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;

/* 字号 */
--fs-display:   clamp(40px, 5.2vw, 64px);  /* Hero 标题 */
--fs-h2:        clamp(28px, 3.6vw, 44px);  /* 段标题 */
--fs-h3:        20px;
--fs-body-lg:   18px;
--fs-body:      16px;
--fs-small:     14px;
--fs-micro:     12px;

/* 字重 */
--fw-medium:    500;
--fw-semibold:  600;
--fw-bold:      700;
```

### 1.3 间距 & 圆角

```css
--space-xs:  4px;
--space-sm:  8px;
--space-md:  16px;
--space-lg:  24px;
--space-xl:  40px;
--space-2xl: 64px;
--space-3xl: 96px;
--radius-sm: 8px;
--radius-md: 16px;
--radius-lg: 24px;
--radius-pill: 999px;
```

### 1.4 动效

```css
--ease:       cubic-bezier(0.22, 1, 0.36, 1);
--dur-fast:   180ms;
--dur-base:   320ms;
--dur-slow:   600ms;
```

---

## 2. 布局（Layout）

### 2.1 顶部 Nav
- 固定通栏，背景 `transparent`（滚动后变 `--bg-base` 加 0.7 模糊）
- 高度 64px
- 三段式：左 logo / 中导航 4 项 / 右 CTA "Start a project"
- 移动端：折叠成汉堡

### 2.2 Hero Section（首屏）
- 视口高度 `min(100vh, 880px)`，上下 padding 96-128px
- Grid `1fr 1.2fr`，左 4 / 右 5
- 左侧内容垂直居中
  - **Subhead（小字+波浪线）**：`Hey there, meet dejavu team.`
  - **Display Title（大标题 Medium 字重）**：
    `We're a small studio. We make music, pictures, and products — and we ship them fast.`
  - **CTAs**：
    - 主按钮（pill 黑色）：`See the work →`
    - 次按钮（带箭头文字链）：`Meet the team →`
  - **Bottom tags**：`/ MUSIC  / IMAGE  / VIDEO  / WEB  / GAME`
- 右侧**主视觉区**：3 个成员卡组成的拼贴（不同尺寸，浮动，有轻微 3D 倾斜）
  - 每张卡：圆角 24px，hover 抬起
  - 卡上：成员照片 + 名字 + role + 1 行 tag

### 2.3 Section 2 — "Who's in the room" (Members)
- 上 1/2 section padding-top 大
- 居中标题 `The studio.`
- 副标题：`Three people. Three crafts. One room in Shanghai.`
- **3 列网格**，每列 1 张大卡
  - 卡片：照片 + 名字（大）+ Role（mono 字体小）+ 简介（2-3 行）+ 能力 tags + "Read more →"
  - hover：阴影加深 + 微微上移 4px

### 2.4 Section 3 — "What we make" (Capabilities)
- 居中标题 `What we make.`
- 5 列能力卡（呼应 Hero 底部 tags）：
  - MUSIC · AI 作曲/词曲/混音
  - IMAGE · 封面/海报/产品图
  - VIDEO · 生成视频/口播/广告
  - WEB · 落地页/官网/H5
  - GAME · 小游戏/互动
- 每张：图标 + 能力名 + 一行说明 + 1-2 个代表作链接
- 浅底卡片，hover 时图标颜色 → 珊瑚红

### 2.5 Section 4 — "Selected work" (Showcase)
- 标题 `Selected work.`
- 3-4 个作品卡：图 + 名 + 1 行 + 链接
- 用游戏站/产品站截图或占位图

### 2.6 Footer
- 通栏深色块（`--ink-primary` 底，文字白色）
- 左侧：大 logo `dejavu` + 一句话
- 中间：email、网易云、GitHub
- 右侧：当前时间（用 JS 跑一个 Asia/Shanghai clock）
- 底部：版权 + "Made in Shanghai 🇨🇳"

---

## 3. 内容文案（copy）

### 3.1 Logo
- 文字：`dejavu`（小写，去掉"team"）
- 旁边 icon：内联 SVG 波形（5 个竖条 + 1 个 pulse 圆点）

### 3.2 Nav
| 位置 | 链接 |
|---|---|
| 中 | Work / Studio / Process / Contact |
| 右 | Start a project →（红色下划线 hover） |

### 3.3 Hero copy
- Sub：`Hey there, meet dejavu team.`
- Title：`We're a small studio. We make music, pictures, and products — and we ship them fast.`
- Sub-line（标题下小字）：`What should we build with you?`
- 主按钮：`See the work →`
- 次按钮：`Meet the team →`
- Tags：`MUSIC / IMAGE / VIDEO / WEB / GAME`

### 3.4 Members
**陶靖明** / Founder & CEO
- Bio：`Defines where the studio goes. Product, partnerships, and the wiring that makes three people move like one.`
- Tags：`Strategy` `Partnerships` `Architecture`

**déjà vu** / Music Director
- Bio：`Writes songs that feel inevitable. AI-assisted composition, lyrics, mixing — and a sharp ear for the finish.`
- Tags：`Composition` `Lyrics` `Mixing`

**创作虾** / Creative Director
- Bio：`Ships the visuals — covers, posters, video, web. Concept to final file, one pass.`
- Tags：`Image` `Video` `Web` `XHS`

### 3.5 Capabilities
- MUSIC · 旋律生成、词曲创作、混音母带
- IMAGE · 封面、海报、产品图、参考图驱动
- VIDEO · Hailuo 文生视频、参考图驱动成片
- WEB · 静态落地页、H5、GitHub Pages 部署
- GAME · 小游戏、互动体验、AI 玩法

### 3.6 Footer
- 一句话：`Three people in Shanghai, building what they want to see.`
- 联系：`hello@dejavuagent.cn` · 网易云 `dejavu` · GitHub `Dejavu835`
- 时间：跑一个 `Asia/Shanghai` 时钟

---

## 4. 交互 & 动效

| 元素 | 行为 |
|---|---|
| Nav 滚动 | 滚过 32px 后背景由透明 → 半透米灰 + 模糊 12px |
| Hero 标题 | 加载时逐行 fade-in + translateY(8px → 0) |
| 右侧 3 张成员卡 | 加载时 staggered 进入（每张延迟 80ms），鼠标 hover 单张抬起 |
| 按钮 hover | 主按钮：背景从 #0F0F0F → #1A1A1A；次按钮：箭头右移 4px |
| Section 进入 | IntersectionObserver 触发 fade-in-up |
| 移动端 nav | 汉堡 → 全屏 modal 菜单 |
| Tags hover | 文字下划线从 0 → 100% 宽 |
| 卡片 hover | 阴影切换 + 上移 4px + 内部图片轻微 scale 1.02 |

---

## 5. 文件结构

```
/next/
├── index.html         # 单页结构
├── styles.css         # token + 全部样式
├── script.js          # 滚动 / 动效 / 时钟 / nav
├── assets/
│   ├── ceo.jpg        # 复用主站
│   ├── music.jpg      # 复用主站
│   ├── creative.jpg   # 复用主站
│   ├── hero-collage.png  # 或单张主视觉
│   ├── work-1.png ... # 作品缩略
│   └── favicon.svg
└── docs/
    └── SPEC.md        # 本文档
```

---

## 6. 验收清单

- [ ] Hero 在 1280×800 视口下不需滚动即可见全
- [ ] 配色严格使用 token，#E94E5B 仅在 logo/强调/hover 出现
- [ ] 5 个 section 顺序：Hero / Members / Capabilities / Selected work / Footer
- [ ] 主按钮在所有 5 个 section 至少 1 处出现
- [ ] 移动端 375px 下不破版（nav 折叠、grid 改 1 列、字号降级）
- [ ] 滚动后 nav 出现背景模糊
- [ ] 首次加载 LCP < 2s（图片用 transform 压缩过的 jpg）
- [ ] `dejavuagent.cn/next/` 打开正常无 404
