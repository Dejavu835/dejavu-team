/* ===========================================================
   dejavu team · /next/ — interactions
   - nav scroll state
   - reveal on scroll (IntersectionObserver)
   - hero figure: 3D tilt + mouse-tracking halo + click-to-fire
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

  // ---------- 3. hero figure: 3D tilt + mouse-tracking halo + laser easter egg ----------
  const heroFigure  = $('#hvFigure');
  const heroSection = $('.hero');
  const halo        = $('#hvHalo');
  const headClick   = $('#hvHeadClick');
  const statusEl    = $('#hvStatus');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (heroFigure && heroSection && !reduceMotion) {
    const MAX_TILT_X = 8;        // deg (subtle nod)
    const MAX_TILT_Y = 14;       // deg (subtle turn)
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
      // 3D tilt on the whole figure (single image now — no separate head cube).
      heroFigure.style.transform =
        `rotateX(${(-dy * MAX_TILT_X).toFixed(2)}deg) ` +
        `rotateY(${(dx * MAX_TILT_Y).toFixed(2)}deg)`;
      // Continue animating until the eased values converge on the target.
      if (Math.abs(targetX - mx) > 0.001 || Math.abs(targetY - my) > 0.001 || active) {
        rafId = requestAnimationFrame(apply);
      } else {
        targetX = 0.5; targetY = 0.5;
        if (mx !== 0.5 || my !== 0.5) rafId = requestAnimationFrame(apply);
      }
    };

    const onMove = (e) => {
      const hr = heroSection.getBoundingClientRect();
      const hx = Math.max(0, Math.min(1, (e.clientX - hr.left) / hr.width));
      const hy = Math.max(0, Math.min(1, (e.clientY - hr.top)  / hr.height));
      targetX = hx; targetY = hy;
      active = true;
      heroSection.classList.add('is-hover');
      if (statusEl && statusEl.textContent !== 'tracking') statusEl.textContent = 'tracking';
      // Halo follows cursor (JS sets CSS vars; CSS animates the gradient).
      if (halo) {
        halo.style.setProperty('--halo-x', (hx * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-y', (hy * 100).toFixed(1) + '%');
        halo.style.setProperty('--halo-i', '0.95');
      }
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
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    heroSection.addEventListener('mousemove', onMove);
    heroSection.addEventListener('mouseleave', onLeave);

    // ---------- 3a. Idle activity: occasional gaze / halo drift when
    // the user is hovering but hasn't moved for 3+ seconds. Keeps the
    // figure feeling "alive" even on a still cursor. ----------
    let lastMoveTime = Date.now();
    const onAnyMove = () => { lastMoveTime = Date.now(); };
    heroSection.addEventListener('mousemove', onAnyMove);
    const idleCheckInterval = setInterval(() => {
      if (!active) return;
      const since = Date.now() - lastMoveTime;
      if (since < 3000) return;
      // Tiny halo drift — pick a random point in the upper 2/3 of the figure
      const rx = 0.25 + Math.random() * 0.5;
      const ry = 0.15 + Math.random() * 0.4;
      targetX = rx; targetY = ry;
      if (halo) {
        halo.style.setProperty('--halo-x', (rx * 100).toFixed(0) + '%');
        halo.style.setProperty('--halo-y', (ry * 100).toFixed(0) + '%');
      }
      if (rafId === null) rafId = requestAnimationFrame(apply);
    }, 1800);

    /* ===========================================================
       EASTER EGG: LASER EYES (Homelander-style)
       Each click on the head/CRT area has a 50% chance of firing
       the red laser beams for 4.5s, then auto-revert. Cooldown of
       1.5s after firing ends before another fire is possible.
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
        setTimeout(() => { laserCooldown = false; }, 1500);
      }, 4500);
    };

    // Primary trigger: the dedicated button overlay over the CRT head.
    if (headClick) {
      headClick.addEventListener('click', (e) => {
        e.stopPropagation();
        // 50% chance per click (was 12% in the old version — head-click is
        // a more deliberate gesture now, so we boost the odds).
        if (Math.random() < 0.5) {
          triggerLaserEyes();
        }
      });
    }
    // Secondary trigger: clicking anywhere on the figure (more random).
    heroFigure.addEventListener('click', (e) => {
      if (e.target.closest('#hvHeadClick')) return;     // already handled
      if (e.target.closest('.hv-status')) return;       // ignore status pill
      if (Math.random() < 0.15) triggerLaserEyes();
    });
  }

  // ---------- 3b. Touch device support: convert touch events to mouse ----------
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
