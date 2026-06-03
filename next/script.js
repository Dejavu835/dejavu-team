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

  // ---------- 3. hero visual: 3D head tilt + eye/glow tracking ----------
  const heroFigure  = $('#hvFigure');
  const heroHead    = $('#hvHead');          // 3D cube (only the head turns)
  const heroSection = $('.hero');
  const eyeL = $('#hvEyeL');
  const eyeR = $('#hvEyeR');
  const glowEl = $('#hvGlow');
  const statusEl = $('#hvStatus');
  // Enable on desktop (>880px, mouse) OR on any touch device. The 3D
  // tilt respects touch events too (the touch handler below dispatches
  // synthetic mousemove so the same code path runs on mobile).
  const okViewport = matchMedia('(min-width: 880px)').matches ||
                     matchMedia('(hover: none)').matches;
  if (heroFigure && heroHead && heroSection && okViewport &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* Tilt ONLY the CSS-3D head cube. The body image is a real photo
       and stays still (product 360° convention). The cube is positioned
       with translateX(-50%) translateZ(36px) so the mouse rotation
       composes ON TOP of that — the final transform is rotation +
       base translate. */
    const MAX_TILT_X = 14;    // deg  (up/down nod)
    const MAX_TILT_Y = 26;    // deg  (left/right head turn)
    let mx = 0.5, my = 0.5;
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

    // Eye/glow tracking uses the WHOLE hero section as reference so
    // the user can be on the hero text and still control the eyes.
    const onMove = (e) => {
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      heroSection.classList.add('is-hover');
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';

      const MAX_EYE_OFFSET = 16;
      const MAX_EYE_OFFSET_Y = 10;
      const ex = (hx - 0.5) * 2 * MAX_EYE_OFFSET;
      const ey = (hy - 0.5) * 2 * MAX_EYE_OFFSET_Y;
      if (eyeL) eyeL.style.setProperty('--ex', ex.toFixed(2) + 'px');
      if (eyeR) eyeR.style.setProperty('--ex', ex.toFixed(2) + 'px');
      if (eyeL) eyeL.style.setProperty('--ey', ey.toFixed(2) + 'px');
      if (eyeR) eyeR.style.setProperty('--ey', ey.toFixed(2) + 'px');

      // Screen glow clamped to the head (figure) bounds
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
