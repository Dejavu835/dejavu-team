/* ===========================================================
   dejavu team · /next/ — interactions
   - nav scroll state
   - reveal on scroll (IntersectionObserver)
   - hero card parallax
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
          // apply per-element delay from data-reveal-delay
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

  // ---------- 3. hero visual: subtle 3D mouse-tilt + eye/glow tracking ----------
  const heroFigure  = $('#hvFigure');
  const heroSection = $('.hero');
  if (heroFigure && heroSection && window.matchMedia('(min-width: 880px) and (prefers-reduced-motion: no-preference)').matches) {
    const MAX_TILT = 3;       // deg  (subtle head turn)
    let mx = 0.5, my = 0.5;
    let targetX = 0.5, targetY = 0.5;
    let rafId = null;
    let active = false;

    const apply = () => {
      rafId = null;
      mx += (targetX - mx) * 0.18;
      my += (targetY - my) * 0.18;
      const dx = mx - 0.5;
      const dy = my - 0.5;
      heroFigure.style.transform = `rotateX(${(-dy * MAX_TILT).toFixed(2)}deg) rotateY(${(dx * MAX_TILT * 2).toFixed(2)}deg)`;
      if (Math.abs(targetX - mx) > 0.001 || Math.abs(targetY - my) > 0.001) {
        rafId = requestAnimationFrame(apply);
      } else if (active) {
        rafId = requestAnimationFrame(apply);
      } else {
        targetX = 0.5; targetY = 0.5;
        if (mx !== 0.5 || my !== 0.5) rafId = requestAnimationFrame(apply);
      }
    };

    // Eye/glow tracking now uses the WHOLE hero section as reference,
    // not just the figure card. Eyes smoothly track the cursor anywhere
    // in the hero area; the screen glow is clamped to the figure bounds.
    const onMove = (e) => {
      // 3D tilt: based on hero section position
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      heroSection.classList.add('is-hover');
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';

      // Eye tracking: position in hero maps to eye offset across the
      // full hero width (so cursor at the LEFT EDGE of the hero = eyes
      // looking full left, even if cursor is on the hero text, not the figure)
      const MAX_EYE_OFFSET = 18;  // px (slightly more than before)
      const MAX_EYE_OFFSET_Y = 12;
      const ex = (hx - 0.5) * 2 * MAX_EYE_OFFSET;
      const ey = (hy - 0.5) * 2 * MAX_EYE_OFFSET_Y;
      if (eyeL) eyeL.style.setProperty('--ex', ex.toFixed(2) + 'px');
      if (eyeR) eyeR.style.setProperty('--ex', ex.toFixed(2) + 'px');
      if (eyeL) eyeL.style.setProperty('--ey', ey.toFixed(2) + 'px');
      if (eyeR) eyeR.style.setProperty('--ey', ey.toFixed(2) + 'px');

      // Screen glow: still clamped to the figure bounds
      if (glowEl) {
        const fr = heroFigure.getBoundingClientRect();
        const fx = Math.max(0, Math.min(1, (e.clientX - fr.left) / fr.width));
        const fy = Math.max(0, Math.min(1, (e.clientY - fr.top)  / fr.height));
        glowEl.style.setProperty('--mx', (fx * 100).toFixed(2) + '%');
        glowEl.style.setProperty('--my', (fy * 100).toFixed(2) + '%');
      }
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      active = false;
      heroSection.classList.remove('is-hover');
      if (statusEl && statusEl.textContent !== 'online') statusEl.textContent = 'online';
      if (glowEl) {
        glowEl.style.setProperty('--mx', '50%');
        glowEl.style.setProperty('--my', '50%');
      }
      if (eyeL) eyeL.style.setProperty('--ex', '0px');
      if (eyeR) eyeR.style.setProperty('--ex', '0px');
      if (eyeL) eyeL.style.setProperty('--ey', '0px');
      if (eyeR) eyeR.style.setProperty('--ey', '0px');
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    const statusEl = $('#hvStatus');
    const glowEl  = $('#hvGlow');
    const eyeL = $('#hvEyeL');
    const eyeR = $('#hvEyeR');

    /* ---------- 3b. Gyroscope eye-tracking for mobile ----------
       On touch-primary devices, listen to DeviceOrientationEvent and
       map device tilt (gamma = left/right, beta = forward/back) to the
       eye --ex/--ey offsets. iOS Safari requires a user gesture before
       requestPermission() can resolve; we wire it to the first tap.
       Coexists with the mouse listener — whichever fires last wins. */
    const MAX_EYE_OFFSET   = 18;  // px (must match the const in onMove)
    const MAX_EYE_OFFSET_Y = 12;
    const isTouchDevice    = matchMedia('(hover: none)').matches;
    const isIOS            = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isTouchDevice && 'DeviceOrientationEvent' in window) {
      let gyroActive = false;
      let gyroOnlineTimer = null;
      const onTilt = (e) => {
        if (e.gamma == null || e.beta == null) return;
        // gamma (-90..90, practical -45..45) → left/right
        const gN = Math.max(0, Math.min(1, (e.gamma + 30) / 60));
        const ex = (gN - 0.5) * 2 * MAX_EYE_OFFSET;
        // beta (0=flat, 90=upright, practical 60..120) → up/down
        // beta 60 = tilted back (look up) → ey negative
        // beta 120 = tilted forward (look down) → ey positive
        const bN = Math.max(0, Math.min(1, (e.beta - 60) / 60));
        const ey = (bN - 0.5) * 2 * MAX_EYE_OFFSET_Y;
        if (eyeL) {
          eyeL.style.setProperty('--ex', ex.toFixed(2) + 'px');
          eyeL.style.setProperty('--ey', ey.toFixed(2) + 'px');
        }
        if (eyeR) {
          eyeR.style.setProperty('--ex', ex.toFixed(2) + 'px');
          eyeR.style.setProperty('--ey', ey.toFixed(2) + 'px');
        }
        // Activate hover state so glow appears on mobile too
        if (heroSection && !heroSection.classList.contains('is-hover')) {
          heroSection.classList.add('is-hover');
        }
        if (statusEl && statusEl.textContent !== 'tracking') {
          statusEl.textContent = 'tracking';
        }
        // Debounced: if device is still for 1.2s, set back to 'online'
        clearTimeout(gyroOnlineTimer);
        gyroOnlineTimer = setTimeout(() => {
          if (statusEl && statusEl.textContent === 'tracking') {
            statusEl.textContent = 'online';
          }
        }, 1200);
      };

      const startGyro = () => {
        if (gyroActive) return;
        if (isIOS && typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission()
            .then((state) => {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', onTilt, { passive: true });
                gyroActive = true;
              }
            })
            .catch((err) => console.warn('gyro permission:', err));
        } else {
          window.addEventListener('deviceorientation', onTilt, { passive: true });
          gyroActive = true;
        }
      };

      if (isIOS) {
        // iOS needs a user gesture to grant sensor permission
        const onFirstTap = () => {
          startGyro();
          document.removeEventListener('touchstart', onFirstTap);
          document.removeEventListener('click', onFirstTap);
        };
        document.addEventListener('touchstart', onFirstTap, { once: true, passive: true });
        document.addEventListener('click', onFirstTap, { once: true });
      } else {
        // Android / non-iOS: just start
        startGyro();
      }
    }

    // Blink: schedule random blinks every 3.5–6.5s
    const blink = () => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('hv-blinking');
        setTimeout(() => document.body.classList.remove('hv-blinking'), 200);
      }
      setTimeout(blink, 3500 + Math.random() * 3000);
    };
    setTimeout(blink, 2200);

    // Listen on the WHOLE hero section (not just the figure)
    heroSection.addEventListener('mousemove', onMove);
    heroSection.addEventListener('mouseleave', onLeave);
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
      // Asia/Shanghai wall-clock
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
