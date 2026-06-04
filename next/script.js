/* ===========================================================
   dejavu team · /next/ — interactions
   - nav scroll state
   - reveal on scroll (IntersectionObserver)
   - hero figure: 3D tilt + halo + iris + ambient red + shake
   - STATE MACHINE: calm → detected → warning (3 clicks)
     (eye state, cover opacity, ambient, iris position, shake
     intensity, and status text all co-vary with state)
   - The 3rd-click laser firing effect was REMOVED (user
     request — the X-pattern kept reading as V). The
     'warning' state is now the climax: cover fully
     transparent (red eyes fully revealed), red ambient
     at 0.9, max shake, status "firing".
   - mobile drawer
   - Shanghai clock
   =========================================================== */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- 1. nav scroll state ----------
  const nav = $('#nav');
  const onScroll = () => {
    if (window.scrollY > 32) nav.classList.add('is-stuck');
    else nav.classList.remove('is-stuck');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- 2. reveal on scroll ----------
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const d = Number(e.target.dataset.revealDelay || 0);
          e.target.style.transitionDelay = `${d}ms`;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // ---------- 3. hero figure: 3D tilt + halo + iris + ambient red + shake ----------
  const heroFigure  = $('#hvFigure');
  const heroSection = $('.hero');
  const halo        = $('#hvHalo');
  const headClick   = $('#hvHeadClick');
  const statusEl    = $('#hvStatus');
  const irisL       = $('#hvEyeIrisL');
  const irisR       = $('#hvEyeIrisR');
  const redAmbient  = $('#hvRedAmbient');
  const wispL       = document.querySelector('.hv-eye-wisp-l');
  const wispR       = document.querySelector('.hv-eye-wisp-r');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===========================================================
  // POSITION CHILDREN VIA JAVASCRIPT (iPad Safari FIX)
  // The previous CSS used left: 35% / top: 32% on the
  // children, which WORKED on Chrome/Firefox but BROKE on
  // iPad Safari. iPad Safari has a known bug where:
  //   aspect-ratio (figure) + transform-style: preserve-3d
  //   (figure) + position: absolute (children)
  // causes the children to be re-positioned to (0, 0) of
  // the figure on the first interaction (e.g., the click
  // that advances the state). translateZ(0) didn't fix it.
  //
  // The bulletproof fix: position the children in PIXELS
  // via JavaScript, based on the figure's actual rendered
  // dimensions. The children have transform: translate(-50%)
  // or translateX(-50%) for centering, so we just need to
  // set their top/left to (eye_center_x, eye_center_y) and
  // the browser does the centering. We re-run this on
  // resize and orientationchange.
  //
  // The AI image is 864x1152 with eyes at:
  //   Left:  center (306, 366) → 35.42% × 31.77%
  //   Right: center (421, 368) → 48.73% × 31.94%
  // ===========================================================
  // fR (figure rect) is computed at the top of the if-block so
  // both positionChildren() and setState() can access it.
  // It's re-computed on each call (cheap — just a getBoundingClientRect).
  let fR = heroFigure.getBoundingClientRect();
  const refreshFR = () => { fR = heroFigure.getBoundingClientRect(); };

  const positionChildren = () => {
    if (!heroFigure) return;
    refreshFR();
    if (fR.width === 0 || fR.height === 0) return; // skip if not rendered

    const setEyePosition = (el, xPct, yPct) => {
      if (!el) return;
      // Convert percentage to pixels. The element's transform
      // (translate(-50%) or translateX(-50%)) handles the
      // centering offset.
      el.style.left = (fR.width * xPct / 100) + 'px';
      el.style.top  = (fR.height * yPct / 100) + 'px';
      el.style.right = 'auto';
      // Force a 3D layer so iPad renders correctly
      if (!el.style.transform || !el.style.transform.includes('translateZ')) {
        const baseTransform = el.classList.contains('hv-eye-iris')
          ? 'translate(-50%, -50%)'
          : (el.classList.contains('hv-eye-wisp')
              ? 'translateX(-50%) rotate(var(--wisp-tilt, 0deg))'
              : 'translate(-50%, -50%)');
        el.style.transform = baseTransform + ' translateZ(0)';
      }
    };

    setEyePosition(irisL,  35.42, 31.77);
    setEyePosition(irisR,  48.73, 31.94);
    setEyePosition(wispL,  35.42, 31.77);
    setEyePosition(wispR,  48.73, 31.94);
  };
  // Run on load + resize + orientation change (iPad rotation)
  positionChildren();
  window.addEventListener('load',      positionChildren);
  window.addEventListener('resize',    positionChildren);
  window.addEventListener('orientationchange', positionChildren);
  // Also re-run on the next frame (catches layout shifts
  // like the hero's responsive layout completing)
  requestAnimationFrame(positionChildren);
  setTimeout(positionChildren, 100);
  setTimeout(positionChildren, 500);

  if (heroFigure && heroSection && !reduceMotion) {
    const MAX_TILT_X = 8;
    const MAX_TILT_Y = 14;
    let mx = 0.5, my = 0.5;
    let targetX = 0.5, targetY = 0.5;
    let rafId = null;
    let active = false;
    let lastMoveTime = Date.now();

    // STATE MACHINE
    // States: 'calm' | 'detected' | 'warning'
    // (firing was removed; 'warning' is now the climax state)
    // Each state controls: cover opacity, red ambient opacity,
    // iris position, shake intensity, status text, and
    // (via CSS class) the cover/iris/laser-source animations.
    // Clicking advances the state by one. If the user pauses
    // for DETECT_DECAY_MS (1.5s), state decays one level back.
    let currentState = 'calm';
    let stateDecayTimer = null;
    const DETECT_DECAY_MS = 1500;
    // (FIRING_DURATION + COOLDOWN_MS removed — no more firing state)
    const STATE_LABELS = {
      calm: 'online',
      detected: 'detected',
      warning: 'firing'    // 'warning' state now reads as "firing" (the climax) but with no lasers
    };

    const setCoverOpacity = (v) => {
      heroFigure.style.setProperty('--eye-cover-opacity', String(Math.max(0, Math.min(1, v))));
    };
    const setRedAmbient = (v) => {
      heroFigure.style.setProperty('--red-i', String(Math.max(0, Math.min(1, v))));
    };

    const setShakeLevel = (level) => {
      // 0 = no shake, 0.3 = light, 0.7 = noticeable, 1.0 = heavy
      shakeLevel = level;
    };

    // Helper: re-compute fR before setState (in case the figure
    // size changed due to a 3D layout shift, etc.)
    const setState = (newState, opts = {}) => {
      refreshFR();
      const prev = currentState;
      currentState = newState;

      // Update figure classes (drives CSS for cover/iris/animations)
      heroFigure.classList.remove('is-detected', 'is-warning');
      if (newState !== 'calm') heroFigure.classList.add('is-' + newState);

      // State parameters. irisY is always 0 (user feedback: don't
      // make the iris jump up — the build-up pressure comes from
      // cover fade + red ambient + screen shake + status text, not
      // from the iris moving).
      //
      // The 3rd-click 'firing' state was removed (user request)
      // because the laser X-pattern kept reading as a V. The
      // state machine now stops at 'warning' (3rd click). On
      // the 3rd click, the cover is fully transparent (red eyes
      // fully revealed), red ambient at 0.9, and after the
      // decay window the state cycles back to detected/calm.
      // WISP EXTENSION per state. Base is 1.0 (left=45%, right=32%
      // figure width). On click 1 (detected) it grows to 1.4.
      // On click 2 (warning) it grows to 2.4 — at 2.4x the LEFT
      // wisp is 108% of figure width (extends well BEYOND the
      // hero card edges), giving the 'light growing out' effect
      // the user wanted. The wisp's 0.6s CSS transition on width
      // makes the growth smooth.
      const params = {
        calm:      { cover: 1.0,  ambient: 0.0,  irisY: 0, shake: 0,   irisX: 0, wispExt: 1.0 },
        detected:  { cover: 0.7,  ambient: 0.18, irisY: 0, shake: 0.5, irisX: 0, wispExt: 1.4 },
        warning:   { cover: 0.0,  ambient: 0.9,  irisY: 0, shake: 1.0, irisX: 0, wispExt: 2.4 }
      };
      const p = params[newState];
      setCoverOpacity(p.cover);
      setRedAmbient(p.ambient);
      setIris(p.irisX, p.irisY);
      setShakeLevel(p.shake);
      // Wisp growth: set the --wisp-extension CSS var on the figure.
      // The .hv-eye-wisp selectors use calc(var(--wisp-base-w) * var(--wisp-extension))
      // to scale their width.
      heroFigure.style.setProperty('--wisp-extension', String(p.wispExt));
      // ALSO set the wisp widths directly in pixels (CSS calc with
      // custom property multiplication doesn't always recompute on
      // iPad Safari when the var changes — belt-and-suspenders).
      if (fR.width > 0) {
        // Use !important via setProperty to override any
        // computed CSS that might be caching the old width.
        const wispLW = (0.45 * p.wispExt * fR.width) + 'px';
        const wispRW = (0.32 * p.wispExt * fR.width) + 'px';
        if (wispL) wispL.style.setProperty('width', wispLW, 'important');
        if (wispR) wispR.style.setProperty('width', wispRW, 'important');
      }

      // Update status text
      if (statusEl) statusEl.textContent = STATE_LABELS[newState];

      // Restart the curious gaze cycle whenever the state
      // machine returns to calm. (Skipped during non-calm
      // states — the gaze is "frozen" while the user is
      // actively engaging with the figure.)
      if (newState === 'calm' && prev !== 'calm') {
        startCuriousGaze();
      }

      // Schedule decay (warning → detected → calm)
      if (stateDecayTimer) { clearTimeout(stateDecayTimer); stateDecayTimer = null; }
      if (newState !== 'calm') {
        stateDecayTimer = setTimeout(() => {
          if (currentState === 'warning')   setState('detected');
          else if (currentState === 'detected') setState('calm');
        }, DETECT_DECAY_MS);
      }
    };

    const cardGlow = $('#hvCardGlow');

    /* ---------- 3a. Iris + halo + card-glow follow cursor ----------
       REDUCED gaze amplitude (was 20×8) so the eye doesn't
       "jerk" — the user said the old 20px movement looked
       robotic. New 7×4 range = subtle, alive. */
    const IRIS_RANGE_X = 7;      /* was 20 — much subtler, "curious looking" without jerking */
    const IRIS_RANGE_Y = 4;      /* was 8 — subtler vertical range */
    // Asymmetric gaze: each eye gets a small L/R offset so the
    // two eyes don't move in perfect lockstep. Mimics real
    // binocular gaze where the eyes are never perfectly
    // synchronized.
    const ASYMMETRY_L = { x: -2, y: -1 };
    const ASYMMETRY_R = { x:  2, y:  1 };
    let currentIrisX = 0, currentIrisY = 0;
    let targetIrisX = 0, targetIrisY = 0;

    const setIris = (nx, ny) => {
      targetIrisX = nx * IRIS_RANGE_X;
      targetIrisY = ny * IRIS_RANGE_Y;
      // Smooth interpolation handled in apply()
    };

    const apply = () => {
      rafId = null;

      // Smooth tilt
      mx += (targetX - mx) * 0.30;
      my += (targetY - my) * 0.30;
      const dx = mx - 0.5;
      const dy = my - 0.5;

      // Smooth iris position (cubic-bezier style — use a
      // 0.18 interpolation factor for a soft, eased feel
      // rather than the previous linear-ish 0.40).
      currentIrisX += (targetIrisX - currentIrisX) * 0.18;
      currentIrisY += (targetIrisY - currentIrisY) * 0.18;
      // ASYMMETRIC gaze: left and right irises each get a small
      // per-eye offset, so they don't move in perfect lockstep.
      // Result: the eyes feel "alive" and not robotic.
      if (irisL) {
        irisL.style.setProperty('--iris-x', (currentIrisX + ASYMMETRY_L.x).toFixed(1) + 'px');
        irisL.style.setProperty('--iris-y', (currentIrisY + ASYMMETRY_L.y).toFixed(1) + 'px');
      }
      if (irisR) {
        irisR.style.setProperty('--iris-x', (currentIrisX + ASYMMETRY_R.x).toFixed(1) + 'px');
        irisR.style.setProperty('--iris-y', (currentIrisY + ASYMMETRY_R.y).toFixed(1) + 'px');
      }

      // No more COVER or COVER-GLOW follow — the eye cover has
      // been removed (the AI red eye is the protagonist, no
      // CSS layer covers it). The cursor-tracker handles the
      // "searchlight" effect via a separate soft warm halo
      // (see .hv-cursor-tracker in styles.css). The WISP also
      // stays static (lens-flare detail, doesn't follow gaze).

      // Shake offset (random, intensity from state)
      let shakeX = 0, shakeY = 0;
      if (shakeLevel > 0) {
        // Intensity multipliers: detected = ±1.4px, warning = ±3.2px
        shakeX = (Math.random() - 0.5) * shakeLevel * 7;
        shakeY = (Math.random() - 0.5) * shakeLevel * 7;
      }

      // Combined transform: shake (translate) + 3D tilt +
      // translateZ(0) at the end forces the figure onto its own
      // GPU compositing layer (iPad Safari fix — without
      // translateZ(0), the children can re-position to (0, 0)
      // of the figure on the first interaction).
      heroFigure.style.transform =
        `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(2)}px) ` +
        `rotateX(${(-dy * MAX_TILT_X).toFixed(2)}deg) ` +
        `rotateY(${(dx * MAX_TILT_Y).toFixed(2)}deg) ` +
        `translateZ(0)`;

      // Keep animating
      if (Math.abs(targetX - mx) > 0.001 ||
          Math.abs(targetY - my) > 0.001 ||
          Math.abs(targetIrisX - currentIrisX) > 0.1 ||
          Math.abs(targetIrisY - currentIrisY) > 0.1 ||
          active ||
          shakeLevel > 0) {
        rafId = requestAnimationFrame(apply);
      } else {
        if (mx !== 0.5 || my !== 0.5) rafId = requestAnimationFrame(apply);
      }
    };

    let shakeLevel = 0;

    const onMove = (e) => {
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      lastMoveTime = Date.now();
      heroSection.classList.add('is-hover');
      if (halo) {
        halo.style.setProperty('--halo-x', (hx * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-y', (hy * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-i', '0.95');
      }
      // CARD-EDGE GLOW: pulses to 0.5 on mouse movement (the
      // user wanted light to "overflow the hero card area").
      // In calm state, this is the first light effect that
      // extends BEYOND the figure's borders (inset: -18%).
      if (cardGlow) {
        cardGlow.style.setProperty('--card-glow-i', '0.5');
      }
      // Iris follows cursor only in calm state (avoid fighting state)
      if (currentState === 'calm') {
        const nx = (hx - 0.5) * 2;
        const ny = (hy - 0.5) * 2;
        targetIrisX = nx * IRIS_RANGE_X;
        targetIrisY = ny * IRIS_RANGE_Y;
      }
      // CURSOR TRACKER — the soft warm light follows the
      // cursor with a 0.6s cubic-bezier ease (CSS transition
      // on the .hv-cursor-tracker transform). The tracker
      // is clamped to within ±40% of the figure so it doesn't
      // drift too far when the cursor is far from the hero.
      if (heroFigure) {
        const tr = heroFigure.getBoundingClientRect();
        // Cursor position relative to the figure's CENTER
        const ttx = e.clientX - (tr.left + tr.width / 2);
        const tty = e.clientY - (tr.top + tr.height / 2);
        // Clamp to within the figure
        const tMaxX = tr.width * 0.4;
        const tMaxY = tr.height * 0.4;
        const tClampedX = Math.max(-tMaxX, Math.min(tMaxX, ttx));
        const tClampedY = Math.max(-tMaxY, Math.min(tMaxY, tty));
        heroFigure.style.setProperty('--cursor-x', tClampedX.toFixed(1) + 'px');
        heroFigure.style.setProperty('--cursor-y', tClampedY.toFixed(1) + 'px');
        heroFigure.classList.add('has-cursor');
      }
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      active = false;
      heroSection.classList.remove('is-hover');
      if (halo) {
        halo.style.setProperty('--halo-i', '0.45');
        halo.style.setProperty('--halo-x', '50%');
        halo.style.setProperty('--halo-y', '30%');
      }
      // CARD-EDGE GLOW fades back when cursor leaves
      if (cardGlow) {
        cardGlow.style.setProperty('--card-glow-i', '0');
      }
      // CURSOR TRACKER: fade out by removing the has-cursor
      // class. The tracker itself transitions opacity 0→1 via
      // CSS (see .hv-figure.has-cursor .hv-cursor-tracker).
      if (heroFigure) {
        heroFigure.classList.remove('has-cursor');
      }
      // Reset iris only in calm state
      if (currentState === 'calm') {
        targetIrisX = 0;
        targetIrisY = 0;
        // Restart the curious gaze cycle after the user
        // leaves. The cycle is set up to skip when active,
        // so this just kicks the scheduler back into gear.
        startCuriousGaze();
      }
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    heroSection.addEventListener('mousemove', onMove);
    heroSection.addEventListener('mouseleave', onLeave);

    /* ---------- 3b. HOVER-TRIGGERED STATE PROGRESSION ----------
       User wanted: 'the effect can also be triggered by
       hovering. If the mouse hovers over the hero card
       for a while, or on mobile if you stay on the page
       for a while, it should slowly trigger.'

       So in addition to CLICK, the state machine can be
       advanced by:
         - Continuous hover on hero for 2.5s
         - Just being on the page for 5s (mobile / no hover)
       After triggering, add a 5s cooldown so it doesn't
       keep re-triggering on the same hover. */
    let hoverStartTime = null;
    const HOVER_TRIGGER_MS = 2500;
    const HOVER_COOLDOWN_MS = 5000;
    let lastHoverTrigger = 0;

    heroSection.addEventListener('mouseenter', () => {
      hoverStartTime = Date.now();
    });
    heroSection.addEventListener('mouseleave', () => {
      hoverStartTime = null;
    });

    // Poll for hover duration (cheap — runs every 500ms)
    setInterval(() => {
      if (!heroFigure) return;
      // Skip during firing cooldown
      if (laserCooldown) return;
      // Skip if not in calm (don't auto-progress during detection/warning)
      if (currentState !== 'calm') return;
      // Skip if within cooldown
      if (Date.now() - lastHoverTrigger < HOVER_COOLDOWN_MS) return;
      // Check if user is hovering (hoverStartTime was set on mouseenter)
      // OR if no hover support at all (mobile / touch) — use page-stay time
      const isHovering = hoverStartTime !== null;
      const isTouchDevice = matchMedia('(hover: none)').matches;
      if (isHovering) {
        if (Date.now() - hoverStartTime > HOVER_TRIGGER_MS) {
          setState('detected');
          lastHoverTrigger = Date.now();
          hoverStartTime = null; // reset so it doesn't keep re-triggering
        }
      } else if (isTouchDevice) {
        // Mobile: auto-progress after 5s of being on the page
        if (Date.now() - lastHoverTrigger > 5000 && Date.now() > 5000) {
          // Use lastHoverTrigger = 0 initially, so this fires after 5s
          if (lastHoverTrigger === 0) {
            lastHoverTrigger = Date.now() - 5000; // offset so the condition is true after first 5s
            return;
          }
        }
      }
    }, 500);

    /* ---------- 3b. Curious gaze drift + blink (idle behavior) ----------
       The user wants the character to feel ALIVE in idle (no
       input). Two effects:

       1. CURIOUS GAZE: instead of purely random micro-drifts,
          the eyes cycle through a sequence of INTENTIONAL
          "curious" positions — look full-left, hold, look
          full-right, hold, glance up, return to center,
          look mid-right, etc. Feels like the character is
          actively scanning its environment, not just
          twitching.

       2. BLINK: every 3-6 seconds (randomized), the eyes
          briefly close + open via a CSS animation
          (see .hv-figure.is-blinking in styles.css).

       Both run ONLY in calm state AND only when there's no
       active mouse tracking (active === false). Mouse/click
       state transitions take priority. */

    // 8 "curious" positions as fraction-of-IRIS_RANGE values.
    // Each entry: {x, y, hold, name}. Coordinates are
    // multiplied by IRIS_RANGE_X/Y in advanceCuriousGaze().
    //
    // x: -1 = full left, 0 = center, +1 = full right
    // y: -1 = full up,   0 = center, +1 = full down
    //
    // The sequence below mimics natural curious-looking:
    //   1. Look LEFT (full)   — "what's over there?"
    //   2. Look RIGHT (full)  — "and over there?"
    //   3. Glance UP          — "what's that?"
    //   4. Center briefly     — "hmm"
    //   5. Look LEFT (mid)    — "wait, what was that?"
    //   6. Look RIGHT (mid)
    //   7. Look up slightly
    //   8. Look down-left
    // ...then the sequence cycles (with 30% chance to skip
    // 2-3 ahead) for variety.
    //
    // Note: y values stay <= 0.3 — we want curious-looking,
    // not dejected (never look DOWN past y=-0.1 in the main
    // positions, except position 8 which is a quick glance
    // down-left, fine for "scanning").
    const CURIOUS_GAZE_POSITIONS = [
      // 1. Full look left (clear directional move)
      { x: -1.0, y: -0.2, hold: 1500, name: 'look_left' },
      // 2. Quick return to center (decide where to look next)
      { x:  0.0, y:  0.0, hold:  300, name: 'center_breath' },
      // 3. Full look right (opposite direction = clear scan)
      { x:  1.0, y: -0.2, hold: 1500, name: 'look_right' },
      // 4. Quick return
      { x:  0.0, y:  0.0, hold:  300, name: 'center_breath' },
      // 5. Settle briefly
      { x:  0.0, y:  0.0, hold:  600, name: 'center_settle' },
      // 6. DOUBLE-TAKE left (look back at the same thing — curious!)
      { x: -1.0, y: -0.2, hold: 1000, name: 'double_take_left' },
      // 7. Center breath
      { x:  0.0, y:  0.0, hold:  400, name: 'center_breath' },
      // 8. "What was that?" — glance straight up
      { x:  0.0, y: -1.0, hold:  700, name: 'glance_up' },
      // 9. Settle
      { x:  0.0, y:  0.0, hold:  500, name: 'center_settle' },
      // 10. Glance up-left
      { x: -0.7, y: -0.7, hold:  900, name: 'glance_up_left' },
      // 11. Center breath
      { x:  0.0, y:  0.0, hold:  300, name: 'center_breath' },
      // 12. Glance up-right
      { x:  0.7, y: -0.7, hold:  900, name: 'glance_up_right' },
      // 13. Settle
      { x:  0.0, y:  0.0, hold:  800, name: 'settle' }
    ];

    let curiousGazeIndex = 0;
    let curiousGazeTimer = null;
    let curiousMicroTimer = null;   // NEW — micro-saccade timer

    const advanceCuriousGaze = () => {
      // If user is hovering or state is non-calm, skip this
      // tick. The next call to startCuriousGaze() (from
      // onLeave or setState→calm) will resume the cycle.
      if (currentState !== 'calm' || active) {
        curiousGazeTimer = null;
        if (curiousMicroTimer) { clearTimeout(curiousMicroTimer); curiousMicroTimer = null; }
        return;
      }

      // Pick the next position in the sequence (with 30%
      // chance to skip 2-3 ahead for variety).
      const pos = CURIOUS_GAZE_POSITIONS[curiousGazeIndex];
      // MAIN target: the position we're looking at
      targetIrisX = pos.x * IRIS_RANGE_X;
      targetIrisY = pos.y * IRIS_RANGE_Y;

      // MICRO-SACCADE: tiny random offset during this hold, so
      // the eye doesn't sit perfectly still. Refreshes every
      // 300ms (via setTimeout) — gives the eye a "scanning"
      // feel even within a single hold position.
      // Skip micro-saccade during center positions (would just
      // be jittery at rest).
      if (Math.abs(pos.x) > 0.2 || Math.abs(pos.y) > 0.2) {
        if (curiousMicroTimer) clearTimeout(curiousMicroTimer);
        const scheduleMicro = () => {
          // Add ±0.10 of IRIS_RANGE_X / ±0.08 of IRIS_RANGE_Y
          targetIrisX += (Math.random() - 0.5) * 2 * 0.10 * IRIS_RANGE_X;
          targetIrisY += (Math.random() - 0.5) * 2 * 0.08 * IRIS_RANGE_Y;
          curiousMicroTimer = setTimeout(scheduleMicro, 300);
        };
        scheduleMicro();
      } else {
        if (curiousMicroTimer) { clearTimeout(curiousMicroTimer); curiousMicroTimer = null; }
      }

      let skip = 1;
      if (Math.random() < 0.3) skip = 2 + Math.floor(Math.random() * 2);
      curiousGazeIndex = (curiousGazeIndex + skip) % CURIOUS_GAZE_POSITIONS.length;

      // Schedule the next advance after the current hold.
      curiousGazeTimer = setTimeout(advanceCuriousGaze, pos.hold);
    };

    // Start (or restart) the curious gaze cycle. Called on
    // initial load AND when the user leaves the figure
    // (and when the state machine returns to calm).
    const startCuriousGaze = () => {
      if (currentState !== 'calm' || active) return;
      if (curiousGazeTimer) clearTimeout(curiousGazeTimer);
      // Small random delay so the gaze doesn't sync with
      // page-load animations or with the mouse-leave event.
      const initialDelay = 600 + Math.random() * 800;
      curiousGazeTimer = setTimeout(advanceCuriousGaze, initialDelay);
    };

    // Start once on load
    startCuriousGaze();

    // HOOK: restart the curious gaze whenever the user
    // leaves the hero (so the cycle resumes after a hover).
    // We piggy-back on the existing onLeave logic below —
    // see onLeave() where startCuriousGaze() is called.

    /* ---------- 3c. Blink scheduler ----------
       Every 3-6 seconds, briefly add .is-blinking to
       .hv-figure for 280ms. The CSS keyframe (hv-eye-blink
       / hv-eye-blink-wisp) handles the actual visual. Only
       blinks in calm state.

       The blink is self-rescheduling — after each blink
       (or skipped blink during active hover), the next
       blink is scheduled with a fresh random delay. */

    const triggerBlink = () => {
      if (!heroFigure) return;
      heroFigure.classList.add('is-blinking');
      setTimeout(() => {
        if (heroFigure) heroFigure.classList.remove('is-blinking');
      }, 280);
    };

    const scheduleBlink = () => {
      // Random 3-6 seconds between blinks
      const delay = 3000 + Math.random() * 3000;
      setTimeout(() => {
        // Only actually blink in calm + idle. The schedule
        // keeps running regardless so the cadence stays
        // natural — we just skip the visual during hover.
        if (currentState === 'calm' && !active) {
          triggerBlink();
        }
        scheduleBlink();
      }, delay);
    };

    // Start the blink loop on load
    scheduleBlink();

    /* ===========================================================
       CLICK STATE PROGRESSION
       Each click advances: calm → detected → warning
       (3 clicks total). The 'firing' state was removed
       (user request — the 3rd click no longer triggers
       lasers, just the climax state with full red eyes
       revealed). The warning state itself is now the
       "climax" — cover fully transparent, red ambient at
       0.9, max shake, status "firing".
       After 1.5s of no clicks, state decays warning →
       detected → calm.
       =========================================================== */
    const advanceState = () => {
      if (currentState === 'calm')     setState('detected');
      else if (currentState === 'detected') setState('warning');
      // No more transition from warning — it just sits there
      // and decays back. The 3rd click is essentially a no-op
      // (user can keep clicking and the state stays at warning
      // until they stop).
      // Halo click feedback — every click triggers a brief
      // brightening/expanding of the halo (visual confirmation
      // that the click was registered). The .is-pulse class
      // is added + removed after the 0.7s animation completes.
      if (halo) {
        halo.classList.remove('is-pulse');
        // Force reflow so the animation restarts on rapid clicks
        void halo.offsetWidth;
        halo.classList.add('is-pulse');
        setTimeout(() => {
          if (halo) halo.classList.remove('is-pulse');
        }, 700);
      }
      // CARD-EDGE GLOW click feedback — on each click, the
      // card-edge glow briefly pulses brighter (matches the
      // halo pulse, gives a synchronized "click registered"
      // visual). Returns to its previous intensity after 0.9s.
      if (cardGlow) {
        cardGlow.classList.remove('is-pulse');
        void cardGlow.offsetWidth;
        cardGlow.classList.add('is-pulse');
        setTimeout(() => {
          if (cardGlow) cardGlow.classList.remove('is-pulse');
        }, 900);
      }
    };

    if (headClick) {
      headClick.addEventListener('click', (e) => {
        e.stopPropagation();
        advanceState();
      });
    }

    // Secondary: random figure click that bumps the state.
    heroFigure.addEventListener('click', (e) => {
      if (e.target.closest('#hvHeadClick')) return;
      if (e.target.closest('.hv-status')) return;
      if (Math.random() < 0.08) {
        // Bump state by 1, but never more than 'warning' from
        // a random figure click (the head button is the main path).
        if (currentState === 'calm') setState('detected');
        else if (currentState === 'detected') setState('warning');
        // Halo click feedback on random figure clicks too
        if (halo) {
          halo.classList.remove('is-pulse');
          void halo.offsetWidth;
          halo.classList.add('is-pulse');
          setTimeout(() => {
            if (halo) halo.classList.remove('is-pulse');
          }, 700);
        }
      }
    });

    // Initialize state
    setState('calm');
  }

  // ---------- 3c. Touch device support ----------
  const isTouchDevice = matchMedia('(hover: none)').matches;
  if (isTouchDevice && heroSection) {
    const touchToMouse = (e) => {
      const t = e.touches[0] || (e.changedTouches && e.changedTouches[0]);
      if (!t) return;
      heroSection.dispatchEvent(new MouseEvent('mousemove', {
        clientX: t.clientX, clientY: t.clientY, bubbles: true
      }));
    };
    const touchEndToMouseLeave = () => {
      heroSection.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    };
    heroSection.addEventListener('touchstart', touchToMouse, { passive: true });
    heroSection.addEventListener('touchmove',  touchToMouse, { passive: true });
    heroSection.addEventListener('touchend',   touchEndToMouseLeave, { passive: true });
    heroSection.addEventListener('touchcancel',touchEndToMouseLeave, { passive: true });
  }

  // ---------- 4. mobile drawer ----------
  const burger = $('#navBurger');
  const drawer = $('#drawer');
  if (burger && drawer) {
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      drawer.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
    });
    $$('a', drawer).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // ---------- 5. Shanghai clock ----------
  const clock = $('#clock');
  const clockDate = $('#clockDate');
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (clock && clockDate) {
    const fmtClock = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const fmtDate = (d) => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[d.getDay()]} ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };
    const tick = () => {
      const now = new Date();
      const sh = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      clock.textContent = fmtClock(sh);
      clockDate.textContent = `${fmtDate(sh)} · CST`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- 6. smooth scroll for in-page anchors (offset for sticky nav) ----------
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
})();
