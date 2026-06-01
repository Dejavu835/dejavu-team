#!/usr/bin/env node
/**
 * Wuziqi AI 自战测试器
 * - 在 vm 沙箱里加载整个 wuziqi/index.html 的 <script> 段（用 Proxy mock DOM）
 * - 让 AI 自己跟自己下 N 局（每难度）
 * - 统计 B 胜 / 平 / W 胜
 */

import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = readFileSync(path.join(__dirname, "index.html"), "utf8");

// 1. 去掉 Ctrl IIFE 末尾的自动 init() 调用（line 883）
// 2. 去掉 Ctrl IIFE 末尾的全屏 IIFE（line 884-908）
// 0-based: line 883 = index 882，line 884-908 = index 883-907
// 但 line 909 是 `})();` 结束 Ctrl IIFE，line 910 是 </script>，要保留 Ctrl IIFE 关闭
const cleanHTML = HTML
  .split("\n")
  .filter((_, i) => i < 882 || (i >= 908 && i <= 909)) // 882 = 883, 908-909 = 909-910 (Ctrl IIFE 关闭 + </script>)
  .join("\n");
const scriptCode = cleanHTML.match(/<script>([\s\S]*?)<\/script>/)[1];

// Mock DOM（Proxy 全部返回 noop/fakeEl）
const noop = () => {};
const fakeStyle = new Proxy({}, { set: () => true, get: () => "" });
const fakeClassList = { add: noop, remove: noop, toggle: noop, contains: () => false };
const fakeCtx = new Proxy({
  save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop,
  stroke: noop, fill: noop, clearRect: noop, fillRect: noop, drawImage: noop,
  arc: noop, scale: noop, translate: noop, setTransform: noop, closePath: noop,
  measureText: () => ({ width: 0 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: noop, fillText: noop, strokeText: noop,
  strokeStyle: "", fillStyle: "", lineWidth: 1, lineCap: "butt",
  globalAlpha: 1, font: "", textAlign: "", textBaseline: "",
}, { get: (t, p) => t[p] !== undefined ? t[p] : noop });

const fakeEl = new Proxy({
  style: fakeStyle, classList: fakeClassList, dataset: {},
  setAttribute: noop, removeAttribute: noop, getAttribute: () => null,
  addEventListener: noop, removeEventListener: noop,
  appendChild: noop, removeChild: noop,
  querySelector: () => fakeEl, querySelectorAll: () => [fakeEl],
  getContext: () => fakeCtx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600, right: 600, bottom: 600 }),
  width: 600, height: 600, hidden: false, textContent: "", innerHTML: "",
  children: [], parentNode: null,
  contains: () => false, cloneNode: () => fakeEl,
  insertBefore: noop, replaceChild: noop, dispatchEvent: noop,
  focus: noop, blur: noop, click: noop, requestFullscreen: noop, exitFullscreen: noop,
}, { get: (t, p) => t[p] !== undefined ? t[p] : noop });

const fakeDoc = new Proxy({
  getElementById: () => fakeEl,
  querySelector: () => fakeEl, querySelectorAll: () => [fakeEl],
  addEventListener: noop, removeEventListener: noop,
  documentElement: fakeEl, body: fakeEl,
  createElement: () => fakeEl, createElementNS: () => fakeEl,
  hidden: false, visibilityState: "visible",
  fullscreenElement: null, exitFullscreen: noop,
}, { get: (t, p) => t[p] !== undefined ? t[p] : noop });

const sandbox = {
  document: fakeDoc,
  window: {
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: noop,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
  },
  performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Array, Object, Map, Set, Number, String, Boolean,
  Promise, Symbol, Error, RegExp, parseInt, parseFloat, isNaN, isFinite,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: noop,
  Proxy, Uint8ClampedArray, Uint8Array, ArrayBuffer,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  // 包一层 IIFE 拿到 Game/AI（顶层 const 不写到 sandbox 全局）
  const wrapped = `(function(){\n${scriptCode}\n; return {Game, AI};\n})()`;
  const result = vm.runInContext(wrapped, sandbox, { filename: "wuziqi_full.js" });
  sandbox.Game = result.Game;
  sandbox.AI = result.AI;
} catch (e) {
  console.error("❌ 加载失败:", e.message);
  console.error(e.stack);
  process.exit(1);
}

const { Game, AI } = sandbox;
if (!Game || !AI) {
  console.error("❌ Game/AI 没暴露");
  process.exit(1);
}
console.log("✅ 加载成功: Game+AI 已就绪");

const GAMES = { easy: 50, mid: 20, hard: 10 };
const DIFFS = ["easy", "mid", "hard"];
const MAX_MOVES = 225;
const MOVE_BUDGET_MS = 1500; // 单步预算：easy 100 / mid 400 / hard 1500
const GAME_BUDGET_MS = 30_000; // 单局 30s 兑底

function playOne(diff) {
  Game.reset(15);
  const start = Date.now();
  let moves = 0;
  while (!Game.getWinner() && moves < MAX_MOVES) {
    if (Date.now() - start > GAME_BUDGET_MS) return { result: "timeout", moves };
    const cur = Game.getCurrent();
    const sz = Game.getSize();
    const brd = Game.getState().board;
    let move;
    try {
      move = AI.getBestMove(brd, sz, cur, diff, Date.now() + MOVE_BUDGET_MS);
    } catch (e) {
      return { result: "error", moves, err: e.message };
    }
    if (!move || typeof move.r !== "number") return { result: "invalid", moves };
    const r = Game.move(move.r, move.c);
    if (!r.ok) return { result: "illegal", moves, move };
    moves++;
  }
  const w = Game.getWinner();
  const result = w === 1 ? "B" : w === 2 ? "W" : w === "draw" ? "draw" : "unknown";
  return { result, moves, ms: Date.now() - start };
}

const stats = {};
for (const d of DIFFS) {
  const N = GAMES[d];
  stats[d] = { B: 0, W: 0, draw: 0, error: 0, totalMoves: 0, totalMs: 0, maxMs: 0, N };
  console.log(`\n🎮 难度=${d} 跑 ${N} 局...`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const r = playOne(d);
    stats[d][r.result] = (stats[d][r.result] || 0) + 1;
    stats[d].totalMoves += r.moves || 0;
    if (r.ms) {
      stats[d].totalMs += r.ms;
      if (r.ms > stats[d].maxMs) stats[d].maxMs = r.ms;
    }
    if ((i + 1) % 5 === 0 || i === N - 1) process.stdout.write(`  ${i + 1}/${N} (last=${r.result},${r.moves || 0}m)\r`);
  }
  process.stdout.write("\n");
  console.log(`  ⏱️  总 ${((Date.now() - t0) / 1000).toFixed(1)}s, 平均 ${(stats[d].totalMs / N).toFixed(0)}ms/局, 最长 ${(stats[d].maxMs / 1000).toFixed(1)}s`);
}

console.log("\n" + "=".repeat(60));
console.log("📊 自战统计 (B=先手 / W=后手)");
console.log("=".repeat(60));
console.log("难度  | 局数 | B 胜 | W 胜 | 平局 | 异常 | 平均手数 | 最长局");
console.log("-".repeat(60));
for (const d of DIFFS) {
  const s = stats[d];
  console.log(
    `${d.padEnd(6)}| ${String(s.N).padStart(3)}  | ${String(s.B).padStart(3)}  | ${String(s.W).padStart(3)}  | ${String(s.draw).padStart(3)}  | ${String(s.error).padStart(3)}   | ${(s.totalMoves / s.N).toFixed(1).padStart(6)}    | ${(s.maxMs / 1000).toFixed(1)}s`
  );
}
console.log("=".repeat(60));

// 验收
const easyDecisive = stats.easy.B + stats.easy.W;
const midDecisive = stats.mid.B + stats.mid.W;
const hardDraw = stats.hard.draw;
console.log(`\n✅ easy 必有胜负: ${easyDecisive}/${stats.easy.N} (期望 100%)`);
console.log(`✅ mid  胜负手  : ${midDecisive}/${stats.mid.N}, 平局 ${stats.mid.draw}`);
console.log(`✅ hard 胜负分布: B=${stats.hard.B} W=${stats.hard.W} draw=${stats.hard.draw}`);
