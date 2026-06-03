/* ===========================================================
   dejavu team · /next/ — interactions
   - nav scroll state
   - reveal on scroll (IntersectionObserver)
   - hero figure: 3D tilt + mouse-tracking halo + curious gaze
   - laser easter egg (3 clicks in 2s → eyes turn red + fire)
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

  // ---------- 3. hero figure: 3D tilt + halo + iris + laser easter egg ----------
  const heroFigure  = $('#hvFigure');
  const heroSection = $('.hero');
  const halo        = $('#hvHalo');
  const headClick   = $('#hvHeadClick');
  const statusEl    = $('#hvStatus');
  const irisL       = $('#hvEyeIrisL');
  const irisR       = $('#hvEyeIrisR');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroFigure && heroSection && !reduceMotion) {
    const MAX_TILT_X = 8;        // deg (subtle nod)
    const MAX_TILT_Y = 14;       // deg (subtle turn)
    let mx = 0.5, my = 0.5;
    let targetX = 0.5, targetY = 0.5;
    let rafId = null;
    let active = false;
    let lastMoveTime = Date.now();

    const apply = () => {
      rafId = null;
      mx += (targetX - mx) * 0.18;
      my += (targetY - my) * 0.18;
      const dx = mx - 0.5;
      const dy = my - 0.5;
      heroFigure.style.transform =
        `rotateX(${(-dy * MAX_TILT_X).toFixed(2)}deg) ` +
        `rotateY(${(dx * MAX_TILT_Y).toFixed(2)}deg)`;
      if (Math.abs(targetX - mx) > 0.001 || Math.abs(targetY - my) > 0.001 || active) {
        rafId = requestAnimationFrame(apply);
      } else {
        targetX = 0.5; targetY = 0.5;
        if (mx !== 0.5 || my !== 0.5) rafId = requestAnimationFrame(apply);
      }
    };

    /* ---------- 3a. Iris follows cursor ----------
       Both irises use a normalized position relative to the figure
       center. JS computes (nx, ny) from cursor and writes CSS vars
       on each iris element. Default centered (0px, 0px). */
    const IRIS_RANGE_X = 8;       // px max offset horizontally
    const IRIS_RANGE_Y = 4;       // px max offset vertically
    const setIris = (nx, ny) => {
      // nx, ny ∈ [-1, +1]
      const ix = (nx * IRIS_RANGE_X).toFixed(1) + 'px';
      const iy = (ny * IRIS_RANGE_Y).toFixed(1) + 'px';
      if (irisL) {
        irisL.style.setProperty('--iris-x', ix);
        irisL.style.setProperty('--iris-y', iy);
      }
      if (irisR) {
        irisR.style.setProperty('--iris-x', ix);
        irisR.style.setProperty('--iris-y', iy);
      }
    };

    const onMove = (e) => {
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      lastMoveTime = Date.now();
      heroSection.classList.add('is-hover');
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';
      if (halo) {
        halo.style.setProperty('--halo-x', (hx * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-y', (hy * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-i', '0.95');
      }
      // Iris snaps to cursor direction (both eyes look same way)
      const nx = (hx - 0.5) * 2;
      const ny = (hy - 0.5) * 2;
      setIris(nx, ny);
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      active = false;
      heroSection.classList.remove('is-hover');
      if (statusEl && statusEl.textContent !== 'online') statusEl.textContent = 'online';
      if (halo) {
        halo.style.setProperty('--halo-i', '0.45');
        halo.style.setProperty('--halo-x', '50%');
        halo.style.setProperty('--halo-y', '30%');
      }
      // Iris returns to center
      setIris(0, 0);
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    heroSection.addEventListener('mousemove', onMove);
    heroSection.addEventListener('mouseleave', onLeave);

    /* ---------- 3b. Curious gaze drift ----------
       When the cursor hasn't moved for 3+ seconds, the irises
       drift to random points within the eye (curious gaze).
       Every 1.8s the drift may shift to a new point. After
       each gaze shift, the iris returns to center after 1.5s
       (or shifts again). Simulates "looking around". */
    let gazeDriftTimer = null;
    const triggerGazeDrift = () => {
      if (active) return;          // skip if user is actively moving
      if (heroFigure.classList.contains('is-firing')) return;
      const nx = (Math.random() - 0.5) * 1.6;
      const ny = (Math.random() - 0.5) * 1.2;
      setIris(nx, ny);
      // Hold gaze for 0.8-1.6s, then drift back
      const holdMs = 800 + Math.random() * 800;
      setTimeout(() => {
        if (!active && !heroFigure.classList.contains('is-firing')) {
          setIris((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4);
        }
      }, holdMs);
    };
    setInterval(() => {
      if (!active) {
        const since = Date.now() - lastMoveTime;
        if (since > 3000) triggerGazeDrift();
      }
    }, 2200);

    /* ===========================================================
       EASTER EGG: LASER EYES (Homelander-style)
       The user wants the laser to fire ONLY after persistent
       clicking — not randomly on a single click. Track clicks
       within a 2-second window; on click N (configurable),
       decay the warm-white eye cover to reveal the red eyes
       and fire the lasers for 4.5s.

       Each click during buildup:
         - Increments click count
         - Reduces eye cover opacity (red shows through)
         - Triggers a brief iris "look up" / warning flash
       At threshold:
         - Cover fully transparent, red eyes visible
         - Both lasers fire (white-core + red optical glow)
         - 4.5s firing, then auto-revert; 1.5s cooldown
       =========================================================== */
    const CLICK_THRESHOLD = 3;        // clicks in window to fire
    const CLICK_WINDOW_MS  = 2200;     // rolling window
    const FIRING_DURATION  = 4500;     // ms
    const COOLDOWN_MS      = 1500;     // ms after firing ends
    let clickCount = 0;
    let clickResetTimer = null;
    let laserCooldown = false;
    let laserEndTimer = null;
    let coverDecayTimer = null;

    const setCoverOpacity = (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      heroFigure.style.setProperty('--eye-cover-opacity', clamped.toFixed(2));
    };

    const resetBuildup = () => {
      clickCount = 0;
      if (clickResetTimer) { clearTimeout(clickResetTimer); clickResetTimer = null; }
      if (coverDecayTimer) { clearTimeout(coverDecayTimer); coverDecayTimer = null; }
      setCoverOpacity(1);
    };

    const triggerLaserEyes = () => {
      if (laserCooldown) return;
      heroFigure.classList.add('is-firing');
      setCoverOpacity(0);            // red eyes fully revealed
      laserCooldown = true;
      if (laserEndTimer) clearTimeout(laserEndTimer);
      laserEndTimer = setTimeout(() => {
        heroFigure.classList.remove('is-firing');
        resetBuildup();
        setTimeout(() => { laserCooldown = false; }, COOLDOWN_MS);
      }, FIRING_DURATION);
    };

    const onHeadClick = (e) => {
      if (laserCooldown) return;
      e.stopPropagation();
      clickCount++;
      if (clickResetTimer) clearTimeout(clickResetTimer);

      // Decay the eye cover based on count vs threshold.
      // 1 click = still mostly white (0.8)
      // 2 clicks = mid (0.4)
      // 3 clicks = transparent (0)
      const ratio = Math.min(clickCount / CLICK_THRESHOLD, 1);
      setCoverOpacity(1 - ratio * 1.0);

      // Brief warning flash — iris jumps to upper position
      setIris((Math.random() - 0.5) * 0.4, -0.8);

      if (clickCount >= CLICK_THRESHOLD) {
        // Fire the lasers!
        setTimeout(triggerLaserEyes, 180);   // small delay so decay is visible
        clickCount = 0;
        if (clickResetTimer) { clearTimeout(clickResetTimer); clickResetTimer = null; }
      } else {
        // Reset click count after the window expires
        clickResetTimer = setTimeout(() => {
          clickCount = 0;
          // Smoothly restore cover if not firing
          if (!heroFigure.classList.contains('is-firing')) {
            setCoverOpacity(1);
          }
        }, CLICK_WINDOW_MS);
      }
    };

    if (headClick) headClick.addEventListener('click', onHeadClick);

    // Secondary: clicking anywhere on the figure (random bonus).
    heroFigure.addEventListener('click', (e) => {
      if (e.target.closest('#hvHeadClick')) return;     // already handled
      if (e.target.closest('.hv-status')) return;       // ignore status pill
      if (Math.random() < 0.1) {
        // Quick-buildup single-click trigger (sets count to threshold-1
        // so a second click within the window fires the laser)
        clickCount = Math.max(clickCount, CLICK_THRESHOLD - 1);
        onHeadClick({ stopPropagation: () => {} });
      }
    });
  }

  // ---------- 3c. Touch device support: convert touch events to mouse ----------
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
