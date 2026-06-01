/* ============================================================
   gomoku.js — 入口，串联 Board / Game / AI / UI
   ============================================================ */

(function () {

  const { EMPTY, BLACK, WHITE } = Game.constants;

  const state = {
    mode: 'pvp',          // 'pvp' | 'pve'
    difficulty: 'mid',    // 'easy' | 'mid' | 'hard'
    playerSide: BLACK,    // 玩家执子
    theme: 'wood',
    thinking: false,
    timerId: null
  };

  // 初始化
  function init() {
    const canvas = document.getElementById('board');

    Game.reset(15);
    Board.init(canvas, {
      size: 15,
      theme: state.theme,
      onCellClick: handleCellClick
    });

    UI.init({
      onNew: handleNew,
      onUndo: handleUndo,
      onHint: handleHint,
      onModeChange: (v) => { state.mode = v; handleNew(); },
      onDiffChange: (v) => { state.difficulty = v; },
      onSideChange: (v) => { state.playerSide = v === 'black' ? BLACK : WHITE; handleNew(); },
      onThemeChange: (t) => {
        state.theme = t;
        Board.setTheme(t);
        UI.setBoardTheme(t);
      },
      onBannerAgain: handleNew
    });

    UI.setBoardTheme(state.theme);
    refreshAll();
    startTimer();
  }

  function refreshAll() {
    const s = Game.getState();
    UI.setTurn(s.current);
    UI.setMoves(s.moves);
    UI.setLog(s.history);
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      const s = Game.getState();
      if (!s.startedAt || s.winner) return;
      const sec = Math.floor((Date.now() - s.startedAt) / 1000);
      UI.setTimer(sec);
    }, 500);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  // 玩家落子
  function handleCellClick(r, c) {
    if (state.thinking) return;
    const s = Game.getState();
    if (s.winner) return;
    if (state.mode === 'pve' && s.current !== state.playerSide) return;

    placeStone(r, c);

    // pve 模式：AI 接手
    if (state.mode === 'pve' && !Game.getWinner()) {
      runAI();
    }
  }

  function placeStone(r, c) {
    const res = Game.move(r, c);
    if (!res.ok) return;
    const s = Game.getState();
    Board.setStone(r, c, s.board[r][c]);
    refreshAll();
    afterMove(res);
  }

  function runAI() {
    if (Game.getWinner()) return;
    const s = Game.getState();
    const aiColor = s.current;
    state.thinking = true;
    UI.setTurn(0);

    // 异步执行避免卡 UI
    setTimeout(() => {
      const move = AI.getBestMove(
        Game.getState().board,
        Game.getSize(),
        aiColor,
        state.difficulty
      );
      state.thinking = false;
      if (move) {
        const res = Game.move(move.r, move.c);
        if (res.ok) {
          Board.setStone(move.r, move.c, Game.getState().board[move.r][move.c]);
          refreshAll();
          afterMove(res);
        }
      }
    }, 200);
  }

  function afterMove(res) {
    if (res.win) {
      const winnerName = Game.getWinner() === BLACK ? '黑方' : '白方';
      UI.showBanner(`${winnerName}胜！`, `连成 5 子 · 共 ${Game.getMoves()} 步`);
      Board.setWinningLine(res.line);
      stopTimer();
    } else if (res.draw) {
      UI.showBanner('和棋', `棋盘下满 · ${Game.getMoves()} 步`);
      stopTimer();
    }
  }

  // ----- 操作 -----
  function handleNew() {
    stopTimer();
    UI.hideBanner();
    Game.reset(15);
    Board.reset(15);
    refreshAll();
    startTimer();
  }

  function handleUndo() {
    if (state.thinking) return;
    const s = Game.getState();
    if (s.history.length === 0) return;
    const steps = state.mode === 'pve' ? 2 : 1;
    Game.undo(steps);
    Board.reset(Game.getSize());
    // 重画所有棋子
    const st = Game.getState();
    for (let r = 0; r < st.size; r++) {
      for (let c = 0; c < st.size; c++) {
        if (st.board[r][c]) Board.setStone(r, c, st.board[r][c]);
      }
    }
    Board.setLastMove(st.history.length ? st.history[st.history.length - 1] : null);
    refreshAll();
  }

  function handleHint() {
    if (state.thinking) return;
    const s = Game.getState();
    if (s.winner) return;
    const color = s.current;
    const move = AI.getBestMove(
      Game.getState().board,
      Game.getSize(),
      color,
      'mid'  // 提示用中等深度
    );
    if (move) {
      Board.setHover(move.r, move.c);
      setTimeout(() => {
        Board.setHover(null);
      }, 2500);
    }
  }

  // DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
