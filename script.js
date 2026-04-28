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
  // Music product card click opens modal
  const musicCard = document.getElementById('music-product-card');
  const musicModal = document.getElementById('detail-music-product');
  const musicModalClose = document.querySelector('.detail-close-music');
  const musicModalBackdrop = musicModal ? musicModal.querySelector('.detail-backdrop') : null;

  if (musicCard && musicModal) {
    musicCard.addEventListener('click', () => {
      musicModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    function closeMusicModal() {
      musicModal.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (musicModalClose) musicModalClose.addEventListener('click', closeMusicModal);
    if (musicModalBackdrop) musicModalBackdrop.addEventListener('click', closeMusicModal);
  }

  // Carousel dot sync
  const carousel = document.querySelector('.product-carousel');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  if (carousel && dots.length) {
    carousel.addEventListener('scroll', () => {
      const idx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, { passive: true });
  }

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 80) {
      nav.style.background = 'rgba(245, 245, 247, 0.98)';
    } else {
      nav.style.background = 'rgba(245, 245, 247, 0.92)';
    }
  });
});
