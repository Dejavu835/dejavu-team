/* ============================================================
   game.js — 游戏状态机 / 胜负判断 / 悔棋
   ============================================================ */

const Game = (() => {

  // color: 0 空 1 黑 2 白
  const EMPTY = 0, BLACK = 1, WHITE = 2;

  let state = {
    size: 15,
    board: [],
    current: BLACK,           // 轮到谁
    history: [],              // [{r, c, color}]
    winner: null,             // null | BLACK | WHITE | 'draw'
    winningLine: null,
    moves: 0,
    startedAt: null
  };

  function reset(size = 15) {
    state.size = size;
    state.board = Array.from({ length: size }, () => Array(size).fill(EMPTY));
    state.current = BLACK;
    state.history = [];
    state.winner = null;
    state.winningLine = null;
    state.moves = 0;
    state.startedAt = null;
  }

  function getState() { return state; }
  function getCurrent() { return state.current; }
  function getSize() { return state.size; }
  function getWinner() { return state.winner; }
  function getWinningLine() { return state.winningLine; }
  function getMoves() { return state.moves; }
  function getHistory() { return state.history; }

  function switchTurn() {
    state.current = state.current === BLACK ? WHITE : BLACK;
  }

  // 落子，返回 { ok, win, line }
  function move(r, c) {
    if (state.winner) return { ok: false, reason: 'game-over' };
    if (state.board[r][c] !== EMPTY) return { ok: false, reason: 'occupied' };

    state.board[r][c] = state.current;
    state.history.push({ r, c, color: state.current });
    state.moves++;
    if (!state.startedAt) state.startedAt = Date.now();

    const line = checkWin(state.board, r, c, state.current);
    if (line) {
      state.winner = state.current;
      state.winningLine = line;
      return { ok: true, win: true, line };
    }

    if (state.moves === state.size * state.size) {
      state.winner = 'draw';
      return { ok: true, draw: true };
    }

    switchTurn();
    return { ok: true };
  }

  // 悔棋：撤一步（pve 同时撤 AI 一步）
  function undo(steps = 1) {
    if (state.history.length === 0) return false;
    for (let i = 0; i < steps && state.history.length > 0; i++) {
      const last = state.history.pop();
      state.board[last.r][last.c] = EMPTY;
      state.current = last.color;
      state.moves--;
    }
    state.winner = null;
    state.winningLine = null;
    return true;
  }

  // 胜负判断：从落子点向 4 个方向各扫一遍
  function checkWin(board, r, c, color) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [{ r, c }];
      // 正向
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc) && board[nr][nc] === color) {
        line.push({ r: nr, c: nc });
        nr += dr; nc += dc;
      }
      // 反向
      nr = r - dr; nc = c - dc;
      while (inBounds(nr, nc) && board[nr][nc] === color) {
        line.unshift({ r: nr, c: nc });
        nr -= dr; nc -= dc;
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  function inBounds(r, c) {
    return r >= 0 && r < state.size && c >= 0 && c < state.size;
  }

  return {
    reset,
    getState,
    getCurrent,
    getSize,
    getWinner,
    getWinningLine,
    getMoves,
    getHistory,
    move,
    undo,
    checkWin,
    constants: { EMPTY, BLACK, WHITE }
  };
})();
