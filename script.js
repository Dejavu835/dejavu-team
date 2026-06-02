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

  // --- Games menu modal (product-games) ---
  const gamesTrigger = document.getElementById('product-games');
  const gamesModal = document.getElementById('games-menu-modal');

  if (gamesTrigger && gamesModal) {
    const openGames = (e) => {
      if (e) e.preventDefault();
      gamesModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    };
    const closeGames = () => {
      gamesModal.classList.remove('active');
      document.body.style.overflow = '';
    };
    gamesTrigger.addEventListener('click', openGames);
    const gamesCloseBtn = gamesModal.querySelector('.detail-close-games');
    const gamesBackdrop = gamesModal.querySelector('.detail-backdrop');
    if (gamesCloseBtn) gamesCloseBtn.addEventListener('click', closeGames);
    if (gamesBackdrop) gamesBackdrop.addEventListener('click', closeGames);

    // Menu items: jump to game URL (stage B: hardcoded; stage D: from games.json)
    // 小游戏二级菜单：产品区不展示独立卡，全部从这里进入
    const gameUrlMap = {
      tank: 'games/tank/index.html',
      wuziqi: 'games/wuziqi/index.html',
      'wuziqi-skill': 'games/wuziqi-skill/index.html'  // 2026-06-02 上线
    };
    gamesModal.querySelectorAll('.games-menu-item[data-game]').forEach(item => {
      item.addEventListener('click', () => {
        const game = item.dataset.game;
        const url = gameUrlMap[game];
        if (url) {
          window.open(url, '_blank', 'noopener');
          closeGames();
        }
      });
    });
  }



  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 80) {
      nav.style.background = 'rgba(245, 245, 247, 0.98)';
    } else {
      nav.style.background = 'rgba(245, 245, 247, 0.92)';
    }
    // scroll progress bar
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (currentScroll / docHeight * 100) + '%' : '0%';
    document.documentElement.style.setProperty('--scroll-progress', progress);
  }, { passive: true });
});
