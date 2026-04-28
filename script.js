document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.team-card');
  const detailViews = document.querySelectorAll('.detail-view');
  const closeButtons = document.querySelectorAll('.detail-close');
  const backdrops = document.querySelectorAll('.detail-backdrop');
  const body = document.body;

  // --- Intersection Observer for card animations ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
      }
    });
  }, { threshold: 0.2 });

  cards.forEach(card => {
    card.style.animationPlayState = 'paused';
    observer.observe(card);

    // Click to open detail
    card.addEventListener('click', () => {
      const member = card.dataset.member;
      const detail = document.getElementById('detail-' + member);
      if (detail) {
        detail.classList.add('active');
        body.style.overflow = 'hidden';
      }
    });
  });

  // --- Close detail handlers ---
  function closeAllDetails() {
    detailViews.forEach(v => v.classList.remove('active'));
    body.style.overflow = '';
  }

  closeButtons.forEach(btn => {
    btn.addEventListener('click', closeAllDetails);
  });

  backdrops.forEach(bg => {
    bg.addEventListener('click', closeAllDetails);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDetails();
  });

  // --- Navbar scroll effect ---
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 80) {
      nav.style.background = 'rgba(245, 245, 247, 0.98)';
    } else {
      nav.style.background = 'rgba(245, 245, 247, 0.92)';
    }
  });
});
