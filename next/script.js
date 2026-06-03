/* ===========================================================
   dejavu team · /next/ — interactions
   - nav scroll state
   - reveal on scroll (IntersectionObserver)
   - hero figure: 3D tilt + halo + iris + ambient red + shake
   - STATE MACHINE: calm → detected → warning → firing
     (eye state, cover opacity, ambient, iris position, shake
     intensity, and status text all co-vary with state)
   - laser easter egg (3 clicks → charge → fire)
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
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroFigure && heroSection && !reduceMotion) {
    const MAX_TILT_X = 8;
    const MAX_TILT_Y = 14;
    let mx = 0.5, my = 0.5;
    let targetX = 0.5, targetY = 0.5;
    let rafId = null;
    let active = false;
    let lastMoveTime = Date.now();

    // STATE MACHINE
    // States: 'calm' | 'detected' | 'warning' | 'firing'
    // Each state controls: cover opacity, red ambient opacity,
    // iris position, shake intensity, status text, and
    // (via CSS class) the cover/iris/laser-source animations.
    // Clicking advances the state by one. If the user pauses
    // for DETECT_DECAY_MS (1.5s), state decays one level back.
    let currentState = 'calm';
    let stateDecayTimer = null;
    let laserCooldown = false;
    const DETECT_DECAY_MS = 1500;
    const FIRING_DURATION = 4500;
    const COOLDOWN_MS = 1500;

    const STATE_LABELS = {
      calm: 'online',
      detected: 'detected',
      warning: 'warning',
      firing: 'firing'
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

    const setState = (newState, opts = {}) => {
      const prev = currentState;
      currentState = newState;

      // Update figure classes (drives CSS for cover/iris/laser-source)
      heroFigure.classList.remove('is-detected', 'is-warning', 'is-firing');
      if (newState !== 'calm') heroFigure.classList.add('is-' + newState);

      // State parameters. irisY is always 0 (user feedback: don't
      // make the iris jump up — the build-up pressure comes from
      // cover fade + red ambient + screen shake + status text, not
      // from the iris moving).
      const params = {
        calm:      { cover: 1.0,  ambient: 0.0,  irisY: 0, shake: 0,   irisX: 0 },
        detected:  { cover: 0.7,  ambient: 0.18, irisY: 0, shake: 0.5, irisX: 0 },
        warning:   { cover: 0.32, ambient: 0.45, irisY: 0, shake: 1.0, irisX: 0 },
        firing:    { cover: 0.0,  ambient: 0.9,  irisY: 0, shake: 0,   irisX: 0 }
      };
      const p = params[newState];
      setCoverOpacity(p.cover);
      setRedAmbient(p.ambient);
      setIris(p.irisX, p.irisY);
      setShakeLevel(p.shake);

      // Update status text
      if (statusEl) statusEl.textContent = STATE_LABELS[newState];

      // Schedule decay / firing end
      if (stateDecayTimer) { clearTimeout(stateDecayTimer); stateDecayTimer = null; }
      if (newState === 'firing') {
        laserCooldown = true;
        stateDecayTimer = setTimeout(() => {
          setState('calm');
          setTimeout(() => { laserCooldown = false; }, COOLDOWN_MS);
        }, FIRING_DURATION);
      } else if (newState !== 'calm') {
        // Decay one level after DETECT_DECAY_MS of inactivity
        stateDecayTimer = setTimeout(() => {
          if (currentState === 'warning')   setState('detected');
          else if (currentState === 'detected') setState('calm');
          else if (currentState === 'firing')  setState('calm');
        }, DETECT_DECAY_MS);
      }
    };

    /* ---------- 3a. Iris + halo follow cursor ---------- */
    const IRIS_RANGE_X = 8;
    const IRIS_RANGE_Y = 4;
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
      mx += (targetX - mx) * 0.18;
      my += (targetY - my) * 0.18;
      const dx = mx - 0.5;
      const dy = my - 0.5;

      // Smooth iris position
      currentIrisX += (targetIrisX - currentIrisX) * 0.25;
      currentIrisY += (targetIrisY - currentIrisY) * 0.25;
      if (irisL) {
        irisL.style.setProperty('--iris-x', currentIrisX.toFixed(1) + 'px');
        irisL.style.setProperty('--iris-y', currentIrisY.toFixed(1) + 'px');
      }
      if (irisR) {
        irisR.style.setProperty('--iris-x', currentIrisX.toFixed(1) + 'px');
        irisR.style.setProperty('--iris-y', currentIrisY.toFixed(1) + 'px');
      }

      // Shake offset (random, intensity from state)
      let shakeX = 0, shakeY = 0;
      if (shakeLevel > 0) {
        // Intensity multipliers: detected = ±1.4px, warning = ±3.2px
        shakeX = (Math.random() - 0.5) * shakeLevel * 7;
        shakeY = (Math.random() - 0.5) * shakeLevel * 7;
      }

      // Combined transform: shake (translate) + 3D tilt
      heroFigure.style.transform =
        `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(2)}px) ` +
        `rotateX(${(-dy * MAX_TILT_X).toFixed(2)}deg) ` +
        `rotateY(${(dx * MAX_TILT_Y).toFixed(2)}deg)`;

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
      // Iris follows cursor only in calm state (avoid fighting state)
      if (currentState === 'calm') {
        const nx = (hx - 0.5) * 2;
        const ny = (hy - 0.5) * 2;
        targetIrisX = nx * IRIS_RANGE_X;
        targetIrisY = ny * IRIS_RANGE_Y;
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
      // Reset iris only in calm state
      if (currentState === 'calm') {
        targetIrisX = 0;
        targetIrisY = 0;
      }
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    heroSection.addEventListener('mousemove', onMove);
    heroSection.addEventListener('mouseleave', onLeave);

    /* ---------- 3b. Auto-loop gaze drift (always on in calm) ----------
       The user wants the eyes to automatically "look around"
       in the calm state, with light effects corresponding to
       the gaze. So the gaze drift runs CONTINUOUSLY in calm
       state, not just on mouse idle.

       The cycle every 1.5s:
         1. Iris darts to a random position in the eye
         2. Holds for 0.8-1.4s
         3. Drifts to a smaller position (resting, not center)
         4. Repeats

       When the user moves the mouse, the iris snaps to the
       cursor direction (overrides auto drift). When the
       cursor leaves, auto drift resumes. */
    let gazeReturnTimer = null;
    const triggerGazeDrift = () => {
      if (currentState !== 'calm') return;
      const nx = (Math.random() - 0.5) * 1.8;
      const ny = (Math.random() - 0.5) * 1.4;
      targetIrisX = nx * IRIS_RANGE_X;
      targetIrisY = ny * IRIS_RANGE_Y;
      const holdMs = 800 + Math.random() * 600;
      if (gazeReturnTimer) clearTimeout(gazeReturnTimer);
      gazeReturnTimer = setTimeout(() => {
        if (currentState === 'calm' && !active) {
          targetIrisX = (Math.random() - 0.5) * 0.8 * IRIS_RANGE_X;
          targetIrisY = (Math.random() - 0.5) * 0.5 * IRIS_RANGE_Y;
        }
      }, holdMs);
    };
    setInterval(() => {
      if (currentState === 'calm' && !active) {
        triggerGazeDrift();
      }
    }, 1500);

    /* ===========================================================
       CLICK STATE PROGRESSION
       Each click advances: calm → detected → warning → firing
       (3 clicks total). Once 'firing' triggers, the lasers run
       for 4.5s and the state auto-reverts to 'calm' with a
       1.5s cooldown. If the user stops clicking, the state
       decays one level every 1.5s (warning → detected → calm).
       =========================================================== */
    const advanceState = () => {
      if (laserCooldown) return;
      if (currentState === 'calm')     setState('detected');
      else if (currentState === 'detected') setState('warning');
      else if (currentState === 'warning')  setState('firing');
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
      if (Math.random() < 0.08 && !laserCooldown) {
        // Bump state by 1, but never more than 'warning' from
        // a random figure click (head click is the only path to fire).
        if (currentState === 'calm') setState('detected');
        else if (currentState === 'detected') setState('warning');
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
