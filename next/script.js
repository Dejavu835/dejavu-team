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

  // ---------- 3. hero visual: subtle 3D mouse-tilt only ----------
  const heroFigure  = $('#hvFigure');
  if (heroFigure && window.matchMedia('(min-width: 880px) and (prefers-reduced-motion: no-preference)').matches) {
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

    const onMove = (e) => {
      const r = heroFigure.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - r.top)  / r.height));
      targetX = nx; targetY = ny;
      active = true;
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';
      // Eye tracking: offset = (nx-0.5, ny-0.5) * MAX_EYE_OFFSET
      eyeDx = (nx - 0.5) * 2;
      eyeDy = (ny - 0.5) * 2;
      scheduleEyeUpdate();
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      active = false;
      if (statusEl && statusEl.textContent !== 'online') statusEl.textContent = 'online';
      eyeDx = 0; eyeDy = 0;
      scheduleEyeUpdate();
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };

    const statusEl = $('#hvStatus');
    const eyeL = $('#hvEyeL');
    const eyeR = $('#hvEyeR');
    const MAX_EYE_OFFSET = 8;   // px (subtle)
    const MAX_EYE_OFFSET_Y = 5;
    let eyeDx = 0, eyeDy = 0;
    let eyeRaf = null;
    let curEyeX = 0, curEyeY = 0;

    // rAF lerp so eyes move smoothly with mouse (and return to center on leave)
    const updateEyes = () => {
      eyeRaf = null;
      curEyeX += (eyeDx - curEyeX) * 0.22;
      curEyeY += (eyeDy - curEyeY) * 0.22;
      const offX = curEyeX * MAX_EYE_OFFSET;
      const offY = curEyeY * MAX_EYE_OFFSET_Y;
      // Skip transform update during blink (blink class overrides)
      if (document.body.classList.contains('hv-blinking')) {
        if (Math.abs(eyeDx - curEyeX) > 0.001 || Math.abs(eyeDy - curEyeY) > 0.001) {
          eyeRaf = requestAnimationFrame(updateEyes);
        }
        return;
      }
      if (eyeL) eyeL.style.transform = `translate(calc(-50% + ${offX.toFixed(2)}px), calc(-50% + ${offY.toFixed(2)}px))`;
      if (eyeR) eyeR.style.transform = `translate(calc(-50% + ${offX.toFixed(2)}px), calc(-50% + ${offY.toFixed(2)}px))`;
      if (Math.abs(eyeDx - curEyeX) > 0.001 || Math.abs(eyeDy - curEyeY) > 0.001) {
        eyeRaf = requestAnimationFrame(updateEyes);
      }
    };
    const scheduleEyeUpdate = () => {
      if (eyeRaf === null) eyeRaf = requestAnimationFrame(updateEyes);
    };

    // Blink: schedule random blinks every 3.5–6.5s
    const blink = () => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('hv-blinking');
        setTimeout(() => document.body.classList.remove('hv-blinking'), 130);
      }
      setTimeout(blink, 3500 + Math.random() * 3000);
    };
    setTimeout(blink, 2200);

    heroFigure.addEventListener('mousemove', onMove);
    heroFigure.addEventListener('mouseleave', onLeave);
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
