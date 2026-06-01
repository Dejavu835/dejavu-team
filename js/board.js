/* ============================================================
   board.js — 棋盘渲染 / 落子绘制 / 鼠标交互
   ============================================================ */

const Board = (() => {

  const PADDING = 28;           // 边距
  const STONE_RADIUS_FACTOR = 0.42;  // 棋子占格比例
  const STONE_SHADOW_BLUR = 4;

  let canvas, ctx;
  let dpr = 1;
  let size = 15;                // 棋盘路数
  let cell = 0;                 // 每格像素
  let originX = 0, originY = 0; // (0,0) 像素坐标
  let boardPx = 0;              // 棋盘总像素

  let stones = [];              // stones[r][c] = 0/1/2
  let lastMove = null;          // {r, c}
  let winningLine = null;       // 5+ 连珠
  let hoverPos = null;          // {r, c}
  let theme = 'wood';
  let onCellClick = null;

  // ----- 初始化 -----
  function init(canvasEl, opts = {}) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    size = opts.size || 15;
    onCellClick = opts.onCellClick || (() => {});
    theme = opts.theme || 'wood';

    dpr = window.devicePixelRatio || 1;
    resize();
    reset();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardPx = cssW;
    cell = (boardPx - PADDING * 2) / (size - 1);
    originX = PADDING;
    originY = PADDING;
    draw();
  }

  // ----- 状态 -----
  function reset(newSize) {
    if (newSize) size = newSize;
    stones = Array.from({ length: size }, () => Array(size).fill(0));
    lastMove = null;
    winningLine = null;
    hoverPos = null;
    resize();
  }

  function setSize(newSize) { reset(newSize); }
  function getSize() { return size; }
  function getStones() { return stones; }

  function setStone(r, c, color) {
    stones[r][c] = color;
    lastMove = { r, c };
    draw();
  }

  function removeStone(r, c) {
    stones[r][c] = 0;
    draw();
  }

  function setLastMove(pos) { lastMove = pos; draw(); }
  function setWinningLine(line) { winningLine = line; draw(); }
  function setHover(pos) { hoverPos = pos; draw(); }
  function setTheme(t) { theme = t; draw(); }

  // ----- 鼠标 -----
  function pickCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const c = Math.round((x - originX) / cell);
    const r = Math.round((y - originY) / cell);
    if (r < 0 || r >= size || c < 0 || c >= size) return null;
    // 距离落点中心 < 0.5 格才接受
    const dx = x - (originX + c * cell);
    const dy = y - (originY + r * cell);
    if (Math.hypot(dx, dy) > cell * 0.5) return null;
    return { r, c };
  }

  function onMouseMove(e) {
    const p = pickCell(e.clientX, e.clientY);
    if (JSON.stringify(p) !== JSON.stringify(hoverPos)) {
      hoverPos = p;
      draw();
    }
  }
  function onMouseLeave() {
    if (hoverPos) { hoverPos = null; draw(); }
  }
  function onClick(e) {
    const p = pickCell(e.clientX, e.clientY);
    if (p) onCellClick(p.r, p.c);
  }
  function onTouch(e) {
    e.preventDefault();
    if (!e.touches.length) return;
    const t = e.touches[0];
    const p = pickCell(t.clientX, t.clientY);
    if (p) onCellClick(p.r, p.c);
  }

  // ----- 坐标转换 -----
  function cellToXY(r, c) {
    return { x: originX + c * cell, y: originY + r * cell };
  }

  // ----- 绘制 -----
  function draw() {
    drawBoard();
    drawStones();
    if (winningLine) drawWinningLine();
    if (hoverPos && !stones[hoverPos.r][hoverPos.c] && !winningLine) {
      drawHover(hoverPos.r, hoverPos.c);
    }
    if (lastMove && !winningLine) drawLastMoveMarker();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, boardPx, boardPx);

    // 背景（主题已在 canvas CSS 设，这里画线）
    ctx.strokeStyle = theme === 'minimal' ? '#d2d2d7' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;

    for (let i = 0; i < size; i++) {
      const xy1 = cellToXY(0, i);
      const xy2 = cellToXY(size - 1, i);
      ctx.beginPath();
      ctx.moveTo(xy1.x, xy1.y);
      ctx.lineTo(xy2.x, xy2.y);
      ctx.stroke();

      const yx1 = cellToXY(i, 0);
      const yx2 = cellToXY(i, size - 1);
      ctx.beginPath();
      ctx.moveTo(yx1.x, yx1.y);
      ctx.lineTo(yx2.x, yx2.y);
      ctx.stroke();
    }

    // 星位（天元 + 四角）
    if (size >= 13 && size % 2 === 1) {
      const stars = size === 15
        ? [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]
        : size === 19
          ? [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]]
          : [[Math.floor(size / 2), Math.floor(size / 2)]];
      ctx.fillStyle = theme === 'minimal' ? '#86868b' : 'rgba(0,0,0,0.55)';
      for (const [r, c] of stars) {
        const p = cellToXY(r, c);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStones() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = stones[r][c];
        if (!v) continue;
        const isWinning = winningLine && winningLine.some(p => p.r === r && p.c === c);
        drawStone(r, c, v, isWinning);
      }
    }
  }

  function drawStone(r, c, color, winning) {
    const { x, y } = cellToXY(r, c);
    const radius = cell * STONE_RADIUS_FACTOR;

    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = STONE_SHADOW_BLUR;
    ctx.shadowOffsetY = 1.5;

    // 球体
    const grad = ctx.createRadialGradient(
      x - radius * 0.35, y - radius * 0.35, radius * 0.1,
      x, y, radius
    );
    if (color === 1) {
      // 黑
      grad.addColorStop(0, '#5a5a5a');
      grad.addColorStop(0.7, '#1a1a1a');
      grad.addColorStop(1, '#000000');
    } else {
      // 白
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#f0f0f0');
      grad.addColorStop(1, '#d8d8d8');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 白棋描边
    if (color === 2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 胜利光晕
    if (winning) {
      ctx.save();
      ctx.shadowColor = '#ff3b30';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLastMoveMarker() {
    if (!lastMove) return;
    const { r, c } = lastMove;
    const { x, y } = cellToXY(r, c);
    const radius = cell * STONE_RADIUS_FACTOR * 0.32;
    const color = stones[r][c] === 1 ? '#ff3b30' : '#ff3b30';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHover(r, c) {
    const { x, y } = cellToXY(r, c);
    const radius = cell * STONE_RADIUS_FACTOR * 0.32;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWinningLine() {
    if (!winningLine || winningLine.length < 2) return;
    const first = cellToXY(winningLine[0].r, winningLine[0].c);
    const last = cellToXY(winningLine[winningLine.length - 1].r, winningLine[winningLine.length - 1].c);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 59, 48, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  return {
    init,
    reset,
    setSize,
    getSize,
    getStones,
    setStone,
    removeStone,
    setLastMove,
    setWinningLine,
    setHover,
    setTheme,
    draw
  };
})();
