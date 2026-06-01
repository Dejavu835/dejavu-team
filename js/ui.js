/* ============================================================
   ui.js — 侧栏控件 / 状态同步 / 落子记录
   ============================================================ */

const UI = (() => {

  const el = (id) => document.getElementById(id);

  const refs = {};
  let onNew = () => {};
  let onUndo = () => {};
  let onHint = () => {};
  let onModeChange = () => {};
  let onDiffChange = () => {};
  let onSideChange = () => {};
  let onThemeChange = () => {};
  let onBannerAgain = () => {};

  function init(handlers) {
    onNew = handlers.onNew || onNew;
    onUndo = handlers.onUndo || onUndo;
    onHint = handlers.onHint || onHint;
    onModeChange = handlers.onModeChange || onModeChange;
    onDiffChange = handlers.onDiffChange || onDiffChange;
    onSideChange = handlers.onSideChange || onSideChange;
    onThemeChange = handlers.onThemeChange || onThemeChange;
    onBannerAgain = handlers.onBannerAgain || onBannerAgain;

    // 缓存 DOM
    refs.modeSeg = el('seg-mode');
    refs.diffSeg = el('seg-diff');
    refs.sideSeg = el('seg-side');
    refs.cardAi = el('card-ai');
    refs.turnStone = el('turn-stone');
    refs.turnName = el('turn-name');
    refs.moves = el('moves');
    refs.timer = el('timer');
    refs.log = el('log');
    refs.banner = el('banner');
    refs.bannerTitle = el('banner-title');
    refs.bannerSub = el('banner-sub');
    refs.board = el('board');

    bindSeg(refs.modeSeg, 'data-mode', (v) => {
      onModeChange(v);
      refs.cardAi.hidden = (v !== 'pve');
    });
    bindSeg(refs.diffSeg, 'data-diff', (v) => onDiffChange(v));
    bindSeg(refs.sideSeg, 'data-side', (v) => onSideChange(v));
    bindTheme();

    el('btn-new').addEventListener('click', onNew);
    el('btn-undo').addEventListener('click', onUndo);
    el('btn-hint').addEventListener('click', onHint);
    el('banner-again').addEventListener('click', () => {
      hideBanner();
      onBannerAgain();
    });

    // 点击 banner 背景关闭
    refs.banner.addEventListener('click', (e) => {
      if (e.target === refs.banner) {
        hideBanner();
        onBannerAgain();
      }
    });

    // 初始隐藏
    hideBanner();
  }

  function bindSeg(container, attr, cb) {
    if (!container) return;
    const btns = container.querySelectorAll('button');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cb(btn.getAttribute(attr));
      });
    });
  }

  function bindTheme() {
    const btns = document.querySelectorAll('.g-theme');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onThemeChange(btn.getAttribute('data-theme'));
      });
    });
  }

  // ----- 状态同步 -----
  function setTurn(color) {
    if (color === 1) {
      refs.turnStone.className = 'g-stone g-stone-black';
      refs.turnName.textContent = '黑方';
    } else if (color === 2) {
      refs.turnStone.className = 'g-stone g-stone-white';
      refs.turnName.textContent = '白方';
    } else {
      refs.turnName.textContent = '—';
    }
  }

  function setMoves(n) { refs.moves.textContent = n; }

  function setTimer(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    refs.timer.textContent = `${m}:${s}`;
  }

  function setLog(history) {
    if (history.length === 0) {
      refs.log.innerHTML = '<div class="g-log-empty">暂无落子</div>';
      return;
    }
    const html = history.map((m, i) => {
      const stone = m.color === 1 ? 'g-log-stone-black' : 'g-log-stone-white';
      const colLetter = String.fromCharCode(65 + m.c);
      return `<span class="g-log-step" title="第 ${i + 1} 手">
        <span class="g-log-stone ${stone}"></span>
        ${i + 1}. ${colLetter}${m.r + 1}
      </span>`;
    }).join('');
    refs.log.innerHTML = html;
    refs.log.scrollTop = refs.log.scrollHeight;
  }

  function showBanner(title, sub) {
    refs.bannerTitle.textContent = title;
    refs.bannerSub.textContent = sub;
    refs.banner.classList.add('show');
  }
  function hideBanner() { refs.banner.classList.remove('show'); }

  function setBoardTheme(theme) {
    refs.board.setAttribute('data-theme', theme);
  }

  return {
    init,
    setTurn,
    setMoves,
    setTimer,
    setLog,
    showBanner,
    hideBanner,
    setBoardTheme
  };
})();
