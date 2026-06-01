/* ============================================================
   ai.js — 五子棋 AI 引擎
   - 模式评分（活三/冲四/活四/连五 威胁权重）
   - alpha-beta 剪枝
   - 难度：easy=深度1, mid=深度2, hard=深度4
   ============================================================ */

const AI = (() => {

  const { EMPTY, BLACK, WHITE } = Game.constants;

  // 棋型评分表（我方视角）
  // 五连、活四、双冲四、冲四活三、活三、双活三、眠四、活二、眠二
  const SCORE = {
    FIVE:        10000000,
    OPEN_FOUR:    1000000,
    FOUR:          100000,
    OPEN_THREE:     10000,
    THREE:           1000,
    OPEN_TWO:          100,
    TWO:               10,
    ONE:                 1
  };

  // 8 个方向
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // 寻找一个点周围的候选落点（限制搜索范围以加速）
  function getCandidates(board, size, radius = 1) {
    const cands = [];
    const seen = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== EMPTY) continue;
        // 周围 radius 范围内有棋子才纳入候选
        let hasNeighbor = false;
        for (let dr = -radius; dr <= radius && !hasNeighbor; dr++) {
          for (let dc = -radius; dc <= radius && !hasNeighbor; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            if (board[nr][nc] !== EMPTY) hasNeighbor = true;
          }
        }
        if (hasNeighbor) {
          const k = r * size + c;
          if (!seen.has(k)) { seen.add(k); cands.push({ r, c }); }
        }
      }
    }
    return cands;
  }

  // 判断棋型 (从 (r, c) 出发，沿 (dr, dc) 看 9 格窗口)
  // 返回 { type, score }
  function evalLine(board, size, r, c, dr, dc, color) {
    const opp = color === BLACK ? WHITE : BLACK;
    const line = [];
    for (let i = -4; i <= 4; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) line.push(-1);
      else line.push(board[nr][nc]);
    }
    // 中心点必须是己方
    const me = board[r][c];
    if (me !== color) return { type: 'none', score: 0 };

    // 中心点的 4 个 5 连窗口（每侧 +1/-1, +2/-2, ... +4/-4）
    // 我们只关心中心点的连珠情况：连续 5 个
    let best = { type: 'none', score: 0 };

    for (let offset = -4; offset <= 0; offset++) {
      const w = [];
      for (let i = 0; i < 5; i++) w.push(line[offset + i + 4]);
      const s = scoreWindow(w, color, opp);
      if (s > best.score) best = { type: 'window', score: s };
    }
    return best;
  }

  // 给定 5 格窗口，评估我方得分
  function scoreWindow(w, color, opp) {
    let me = 0, en = 0, empty = 0, edgeBlock = 0;
    for (const v of w) {
      if (v === color) me++;
      else if (v === opp) en++;
      else empty++;
    }
    if (en > 0) return 0; // 对方有子，废棋
    switch (me) {
      case 5: return SCORE.FIVE;
      case 4: return empty === 1 ? SCORE.OPEN_FOUR : SCORE.FOUR;
      case 3: return empty === 2 ? SCORE.OPEN_THREE : (empty === 1 ? SCORE.THREE : 0);
      case 2: return empty === 3 ? SCORE.OPEN_TWO : (empty === 2 ? SCORE.TWO : 0);
      case 1: return empty === 4 ? SCORE.ONE : 0;
      default: return 0;
    }
  }

  // 评估局面（我方 - 对方）
  function evaluate(board, size, myColor) {
    let my = 0, en = 0;
    // 对每个点 + 每个方向
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = board[r][c];
        if (v === EMPTY) continue;
        for (const [dr, dc] of DIRS) {
          // 避免重复：从每个"线段起点"开始
          // 起点定义为 r-dr, c-dc 是边界或空格/异色
          const pr = r - dr, pc = c - dc;
          const isStart = pr < 0 || pr >= size || pc < 0 || pc >= size || board[pr][pc] !== v;
          if (!isStart) continue;
          // 收集 5 格窗口
          for (let k = 0; k < 5; k++) {
            const nr = r + dr * k, nc = c + dc * k;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
            const w = [];
            let valid = true;
            for (let i = 0; i < 5; i++) {
              const wr = nr + dr * i, wc = nc + dc * i;
              if (wr < 0 || wr >= size || wc < 0 || wc >= size) { valid = false; break; }
              w.push(board[wr][wc]);
            }
            if (!valid) continue;
            const s = scoreWindow(w, v, v === BLACK ? WHITE : BLACK);
            if (v === myColor) my += s;
            else en += s;
          }
        }
      }
    }
    return my - en;
  }

  // 启发式评分：单步分数
  function heuristicMove(board, size, r, c, color) {
    const opp = color === BLACK ? WHITE : BLACK;
    let score = 0;
    for (const [dr, dc] of DIRS) {
      const w = [];
      for (let i = -4; i <= 4; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) w.push(-1);
        else w.push(board[nr][nc]);
      }
      // 模拟落子
      w[4] = color;
      score += scoreWindow(w, color, opp);
    }
    return score;
  }

  // 复制 board
  function cloneBoard(board, size) {
    const nb = new Array(size);
    for (let r = 0; r < size; r++) nb[r] = board[r].slice();
    return nb;
  }

  // alpha-beta 搜索（操作的是 copy，不污染原 board）
  function search(board, size, depth, alpha, beta, maximizing, myColor) {
    const score = evaluate(board, size, myColor);
    if (Math.abs(score) >= SCORE.FIVE) return score;
    if (depth === 0) return score;

    const cands = getCandidates(board, size, 1);
    if (cands.length === 0) return score;

    // 排序：启发式分数高的优先
    const current = maximizing ? myColor : (myColor === BLACK ? WHITE : BLACK);
    cands.forEach(c => {
      c.h = heuristicMove(board, size, c.r, c.c, current);
    });
    cands.sort((a, b) => b.h - a.h);
    const limit = Math.min(cands.length, depth >= 3 ? 12 : 18);

    if (maximizing) {
      let best = -Infinity;
      for (let i = 0; i < limit; i++) {
        const c = cands[i];
        board[c.r][c.c] = current;
        const v = search(board, size, depth - 1, alpha, beta, false, myColor);
        board[c.r][c.c] = EMPTY;
        best = Math.max(best, v);
        alpha = Math.max(alpha, v);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < limit; i++) {
        const c = cands[i];
        board[c.r][c.c] = current;
        const v = search(board, size, depth - 1, alpha, beta, true, myColor);
        board[c.r][c.c] = EMPTY;
        best = Math.min(best, v);
        beta = Math.min(beta, v);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  // 主入口：返回 { r, c }
  function getBestMove(board, size, myColor, difficulty = 'mid') {
    const depth = difficulty === 'easy' ? 1 : difficulty === 'mid' ? 2 : 4;
    const cands = getCandidates(board, size, 1);

    if (cands.length === 0) {
      // 空棋盘：落中心
      return { r: Math.floor(size / 2), c: Math.floor(size / 2) };
    }

    cands.forEach(c => {
      c.h = heuristicMove(board, size, c.r, c.c, myColor);
    });
    cands.sort((a, b) => b.h - a.h);

    // 检查是否能直接五连
    for (const c of cands) {
      board[c.r][c.c] = myColor;
      const line = Game.checkWin ? Game.checkWin(board, c.r, c.c, myColor) : null;
      board[c.r][c.c] = EMPTY;
      if (line) return c;
    }

    // 检查对方是否下一步能成五（必须防守）
    const opp = myColor === BLACK ? WHITE : BLACK;
    for (const c of cands) {
      board[c.r][c.c] = opp;
      const line = Game.checkWin ? Game.checkWin(board, c.r, c.c, opp) : null;
      board[c.r][c.c] = EMPTY;
      if (line) return c;
    }

    // 极小搜索（在 copy 上跑，不污染原 board）
    const searchBoard = cloneBoard(board, size);
    let best = cands[0], bestVal = -Infinity;
    const limit = Math.min(cands.length, depth >= 3 ? 10 : 14);
    for (let i = 0; i < limit; i++) {
      const c = cands[i];
      searchBoard[c.r][c.c] = myColor;
      const v = search(searchBoard, size, depth - 1, -Infinity, Infinity, false, myColor);
      searchBoard[c.r][c.c] = EMPTY;
      if (v > bestVal) { bestVal = v; best = c; }
    }
    return best;
  }

  return { getBestMove, getCandidates, evaluate };
})();
