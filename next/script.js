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

  // ---------- 3. hero visual: 3D head tilt + continuous eye tracking ----------
  const heroFigure  = $('#hvFigure');
  const heroHead    = $('#hvHead');          // 3D cube (only the head turns)
  const heroSection = $('.hero');
  const eyeL = $('#hvEyeL');
  const eyeR = $('#hvEyeR');
  const statusEl = $('#hvStatus');
  // Enable on desktop (>880px, mouse) OR on any touch device.
  const okViewport = matchMedia('(min-width: 880px)').matches ||
                     matchMedia('(hover: none)').matches;
  if (heroFigure && heroHead && heroSection && eyeL && eyeR && okViewport &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* Tilt ONLY the CSS-3D head cube. Body photo stays still.
       The cube is positioned with translateX(-50%) translateZ(36px) so
       the mouse rotation composes ON TOP of that base position. */
    const MAX_TILT_X = 14;    // deg  (up/down nod)
    const MAX_TILT_Y = 26;    // deg  (left/right head turn)
    let mx = 0.5, my = 0.5;
    let lastMoveTime = Date.now();  // tracks last mouse activity for idle drift
    let targetX = 0.5, targetY = 0.5;
    let rafId = null;
    let active = false;

    const apply = () => {
      rafId = null;
      mx += (targetX - mx) * 0.22;
      my += (targetY - my) * 0.22;
      const dx = mx - 0.5;
      const dy = my - 0.5;
      // IMPORTANT: this OVERWRITES the base translateX(-50%) translateZ(36px).
      // We re-apply them on every frame so the head stays centered + forward.
      heroHead.style.transform =
        `translateX(-50%) translateZ(36px) ` +
        `rotateX(${(-dy * MAX_TILT_X).toFixed(2)}deg) ` +
        `rotateY(${(dx * MAX_TILT_Y).toFixed(2)}deg)`;
      if (Math.abs(targetX - mx) > 0.001 || Math.abs(targetY - my) > 0.001) {
        rafId = requestAnimationFrame(apply);
      } else if (active) {
        rafId = requestAnimationFrame(apply);
      } else {
        targetX = 0.5; targetY = 0.5;
        if (mx !== 0.5 || my !== 0.5) rafId = requestAnimationFrame(apply);
      }
    };

    // Eye tracking — smooth continuous translation, not frame-swap.
    // The eyes are 2 CSS ovals at fixed left:22% / 60% baseline; we
    // apply a translate3d offset based on mouse X/Y so they appear
    // to "look around" the CRT screen.
    const EYE_BASE_L = 30;       // baseline left% of left eye (more centered, smaller gap)
    const EYE_BASE_R = 60;       // baseline left% of right eye (L center 38%, R center 68%, 30% gap)
    const EYE_RANGE_X = 12;       // px each eye can move horizontally
    const EYE_RANGE_Y = 6;        // px each eye can move vertically
    const onMove = (e) => {
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      lastMoveTime = Date.now();   // mark this as the latest mouse-move
      heroSection.classList.add('is-hover');
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';

      // Normalized -1..+1
      const nx = (hx - 0.5) * 2;
      const ny = (hy - 0.5) * 2;

      // Move both eyes in the same direction (parallel motion)
      const lx = (nx * EYE_RANGE_X).toFixed(2) + 'px';
      const ly = (ny * EYE_RANGE_Y).toFixed(2) + 'px';
      // Use translate3d on top of the base 'left' positioning
      eyeL.style.transform = `translate3d(${lx}, ${ly}, 4px)`;
      eyeR.style.transform = `translate3d(${lx}, ${ly}, 4px)`;
      // Re-set base 'left' (just to be safe — CSS left was set in stylesheet)
      eyeL.style.left = EYE_BASE_L + '%';
      eyeR.style.left = EYE_BASE_R + '%';

      // Ambient GLOW on .hv-monitor — follows the cursor. Drives the
      // --glow-x/y CSS variables that position the radial gradient, and
      // --glow-i for intensity (brighter when mouse is active on hero,
      // dimmer when idle). The glow extends BEYOND the CRT screen so
      // it visibly illuminates the head shell and figure surroundings.
      const monitorGlow = document.querySelector('#hvMonitorGlow');
      if (monitorGlow) {
        // Map hx/hy (0-1) to the monitor's local coordinate system.
        // The monitor is the full front face; we just use hx/hy directly.
        monitorGlow.style.setProperty('--glow-x', (hx * 100).toFixed(1) + '%');
        monitorGlow.style.setProperty('--glow-y', (hy * 100).toFixed(1) + '%');
        monitorGlow.style.setProperty('--glow-i', '0.85');
      }

      // Body parallax — body follows the cursor too, but with much less
      // amplitude than the head/eyes (it's the body, not the face).
      // Set transform DIRECTLY on the body element (CSS var() didn't
      // re-evaluate in transform during the transition). Range: ±4px X,
      // ±2px Y. The body shifts slightly in the same direction as the
      // cursor so head+body feel like one connected character.
      const heroBody = document.querySelector('.hv-body');
      if (heroBody) {
        const BODY_RANGE_X = 4;
        const BODY_RANGE_Y = 2;
        const bX = (nx * BODY_RANGE_X).toFixed(2);
        const bY = (ny * BODY_RANGE_Y).toFixed(2);
        heroBody.style.transform = `translate3d(${bX}px, ${bY}px, 0) scale(1)`;
      }

      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      active = false;
      heroSection.classList.remove('is-hover');
      if (statusEl && statusEl.textContent !== 'online') statusEl.textContent = 'online';
      // Reset eyes to center
      eyeL.style.transform = 'translate3d(0, 0, 4px)';
      eyeR.style.transform = 'translate3d(0, 0, 4px)';
      // Reset body parallax to center
      const heroBody = document.querySelector('.hv-body');
      if (heroBody) heroBody.style.transform = 'translate3d(0, 0, 0) scale(1)';
      // Dim the ambient glow (still has a soft idle glow at 0.3)
      const monitorGlow = document.querySelector('#hvMonitorGlow');
      if (monitorGlow) {
        monitorGlow.style.setProperty('--glow-i', '0.3');
        monitorGlow.style.setProperty('--glow-x', '50%');
        monitorGlow.style.setProperty('--glow-y', '50%');
      }
      // Trigger one quick blink when cursor leaves
      triggerBlink();
      // Then start random gaze drift (eyes look around while idle)
      scheduleGazeDrift();
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    /* ===========================================================
       EYE LIFE — blink, glow pulse, screen sweep, random gaze
       =========================================================== */

    // === Bootup sequence: page load → eyes open with a bright flash
    if (eyeL && eyeR) {
      eyeL.classList.add('is-booting');
      eyeR.classList.add('is-booting');
      setTimeout(() => {
        if (eyeL) eyeL.classList.remove('is-booting');
        if (eyeR) eyeR.classList.remove('is-booting');
        // First random blink 2-3s after bootup
        scheduleBlink(2000 + Math.random() * 1000);
      }, 1200);
    }

    // === Blink — vertical squash. Triggered randomly every 3-7s
    // and once when mouse leaves the hero.
    let blinkTimeout = null;
    const triggerBlink = () => {
      if (!eyeL || !eyeR) return;
      eyeL.classList.add('is-blinking');
      eyeR.classList.add('is-blinking');
      setTimeout(() => {
        if (eyeL) eyeL.classList.remove('is-blinking');
        if (eyeR) eyeR.classList.remove('is-blinking');
      }, 200);
    };
    const scheduleBlink = (delay) => {
      if (blinkTimeout) clearTimeout(blinkTimeout);
      blinkTimeout = setTimeout(() => {
        triggerBlink();
        scheduleBlink(3000 + Math.random() * 4000); // 3-7s
      }, delay);
    };

    // === Random gaze drift — when mouse leaves, eyes occasionally
    // dart to a random point on the CRT and back. Gives the head
    // a sense of being "alive" even when the user isn't interacting.
    let gazeTimeout = null;
    let gazeActive = false;       // true while drift is overriding
    const startGazeDrift = () => {
      if (!eyeL || !eyeR) return;
      gazeActive = true;
      const dx = (Math.random() - 0.5) * 2 * EYE_RANGE_X;
      const dy = (Math.random() - 0.5) * 2 * EYE_RANGE_Y;
      eyeL.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 4px)`;
      eyeR.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 4px)`;
    };
    const scheduleGazeDrift = () => {
      if (gazeTimeout) clearTimeout(gazeTimeout);
      gazeTimeout = setTimeout(() => {
        if (!active && gazeActive) {
          // dart to a random point for 1-2.5s, then back to center
          startGazeDrift();
          setTimeout(() => {
            if (!active) {  // only reset if mouse is still outside
              if (eyeL) eyeL.style.transform = 'translate3d(0, 0, 4px)';
              if (eyeR) eyeR.style.transform = 'translate3d(0, 0, 4px)';
            }
            scheduleGazeDrift();  // schedule next drift
          }, 1000 + Math.random() * 1500);
        }
      }, 1500 + Math.random() * 2500);
    };
    // Stop drift when mouse comes back
    const onEnter = () => {
      gazeActive = false;
      if (gazeTimeout) clearTimeout(gazeTimeout);
    };
    heroSection.addEventListener('mouseenter', onEnter);

    // === IDLE MODE — when mouse is on hero but stationary for 3s+,
    // trigger a quick random gaze drift + maybe a blink. The user
    // asked for the dynamic animations to keep playing even when
    // they're not interacting.
    let idleCheckInterval = null;
    const triggerIdleActivity = () => {
      if (!active) return;             // mouse has left hero, onLeave handles it
      const since = Date.now() - lastMoveTime;
      if (since < 3000) return;        // mouse still moving recently, skip
      // Random brief gaze drift
      const dX = (Math.random() - 0.5) * 2 * EYE_RANGE_X;
      const dY = (Math.random() - 0.5) * 2 * EYE_RANGE_Y;
      eyeL.style.transform = `translate3d(${dX.toFixed(1)}px, ${dY.toFixed(1)}px, 4px)`;
      eyeR.style.transform = `translate3d(${dX.toFixed(1)}px, ${dY.toFixed(1)}px, 4px)`;
      // Also update ambient glow to follow the random gaze
      const monitorGlow2 = document.querySelector('#hvMonitorGlow');
      if (monitorGlow2) {
        monitorGlow2.style.setProperty('--glow-x', (50 + dX * 1.5).toFixed(0) + '%');
        monitorGlow2.style.setProperty('--glow-y', (50 + dY * 2).toFixed(0) + '%');
        monitorGlow2.style.setProperty('--glow-i', '0.7');
      }
      // Maybe blink too
      if (Math.random() < 0.5) {
        triggerBlink();
      }
      // After 1-1.5s return eyes to "last seen" position (use a tiny
      // 0 transform — the next onMove will reset to mouse if user moves)
      setTimeout(() => {
        if (active) {
          eyeL.style.transform = 'translate3d(0, 0, 4px)';
          eyeR.style.transform = 'translate3d(0, 0, 4px)';
        }
      }, 1200);
    };
    idleCheckInterval = setInterval(triggerIdleActivity, 1500);



    /* ---------- 3b. Touch-based eye-tracking for mobile ----------
       Gyroscope (DeviceOrientationEvent) was tried first, but on iOS
       the requestPermission() prompt never fires reliably. Switching
       to a simpler / more predictable approach: convert touch events
       into synthetic mousemove/mouseleave on the hero section, so
       the existing desktop eye-tracking code does the work.
         - touchstart / touchmove → mousemove (eyes look at touch point)
         - touchend / touchcancel  → mouseleave (eyes return to center) */
    const isTouchDevice = matchMedia('(hover: none)').matches;
    if (isTouchDevice) {
      const touchToMouse = (e) => {
        const t = e.touches[0] || (e.changedTouches && e.changedTouches[0]);
        if (!t) return;
        heroSection.dispatchEvent(new MouseEvent('mousemove', {
          clientX: t.clientX,
          clientY: t.clientY,
          bubbles: true
        }));
      };
      const touchEndToMouseLeave = () => {
        heroSection.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      };
      heroSection.addEventListener('touchstart', touchToMouse, { passive: true });
      heroSection.addEventListener('touchmove',  touchToMouse, { passive: true });
      heroSection.addEventListener('touchend',   touchEndToMouseLeave, { passive: true });
      heroSection.addEventListener('touchcancel',touchEndToMouseLeave, { passive: true });

    /* ===========================================================
       EASTER EGG: LASER EYES (Homelander-style)
       Each click on the figure has a ~12% chance of triggering red
       laser eyes for 4.5s, then auto-revert. Cooldown of 1.5s after
       firing ends before another fire is possible.
       =========================================================== */
    let laserCooldown = false;
    let laserEndTimer = null;
    const triggerLaserEyes = () => {
      if (laserCooldown) return;
      heroFigure.classList.add('is-firing');
      laserCooldown = true;
      if (laserEndTimer) clearTimeout(laserEndTimer);
      laserEndTimer = setTimeout(() => {
        heroFigure.classList.remove('is-firing');
        // Brief cooldown to prevent rapid retriggering
        setTimeout(() => { laserCooldown = false; }, 1500);
      }, 4500);  // fire for 4.5s then auto-revert
    };
    // Listen on the figure (covers both head and body area)
    heroFigure.style.cursor = 'pointer';
    heroFigure.addEventListener('click', (e) => {
      // Don't fire if user is selecting text in a label or something
      if (e.target.closest('.hv-status')) return;  // ignore clicks on ONLINE pill
      // ~12% chance per click; after 12+ clicks without fire, force fire
      if (Math.random() < 0.12) {
        triggerLaserEyes();
      }
    });
    // Also allow double-tap on mobile to fire (touchend emits click on most browsers)
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
