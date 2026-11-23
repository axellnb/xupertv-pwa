// XuperTV PWA Engine & Stremio Client
(() => {
  // Application State
  const state = {
    movies: [],
    series: [],
    favorites: JSON.parse(localStorage.getItem('xupertv_favs') || '[]'),
    activeItem: null,
    activeType: 'movie',
    currentSeason: 1,
    currentEpisode: 1,
    currentServer: 'multiembed',
    searchDebounce: null,
  };

  // DOM Elements
  const brandHomeBtn = document.getElementById('brandHomeBtn');
  const heroBg = document.getElementById('heroBg');
  const heroTitle = document.getElementById('heroTitle');
  const heroOverview = document.getElementById('heroOverview');
  const heroRating = document.getElementById('heroRating');
  const heroYear = document.getElementById('heroYear');
  const heroPlayBtn = document.getElementById('heroPlayBtn');
  const heroInfoBtn = document.getElementById('heroInfoBtn');

  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchResultsSection = document.getElementById('searchResultsSection');
  const searchResultsGrid = document.getElementById('searchResultsGrid');
  const searchResultsTitle = document.getElementById('searchResultsTitle');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const catalogSections = document.getElementById('catalogSections');
  const favoritesSection = document.getElementById('favoritesSection');
  const favoritesGrid = document.getElementById('favoritesGrid');
  const favoritesCount = document.getElementById('favoritesCount');

  // Carousels
  const carouselTrending = document.getElementById('carouselTrending');
  const carouselMovies = document.getElementById('carouselMovies');
  const carouselSeries = document.getElementById('carouselSeries');
  const carouselAction = document.getElementById('carouselAction');
  const carouselSciFi = document.getElementById('carouselSciFi');
  const trendingCount = document.getElementById('trendingCount');

  // Modals
  const detailDialog = document.getElementById('detailDialog');
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  const dialogPoster = document.getElementById('dialogPoster');
  const dialogBackdrop = document.getElementById('dialogBackdrop');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogType = document.getElementById('dialogType');
  const dialogYear = document.getElementById('dialogYear');
  const dialogRating = document.getElementById('dialogRating');
  const dialogGenres = document.getElementById('dialogGenres');
  const dialogOverview = document.getElementById('dialogOverview');
  const dialogFavBtn = document.getElementById('dialogFavBtn');
  const favBtnLabel = document.getElementById('favBtnLabel');
  const quickPlayBtn = document.getElementById('quickPlayBtn');
  const openInStremioQuickBtn = document.getElementById('openInStremioQuickBtn');
  const openInVlcQuickBtn = document.getElementById('openInVlcQuickBtn');
  const appContainer = document.getElementById('app');
  const seriesControls = document.getElementById('seriesControls');
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  const streamsList = document.getElementById('streamsList');

  // Player
  const playerDialog = document.getElementById('playerDialog');
  const playerContainer = document.getElementById('playerContainer');
  const playerOverlay = document.getElementById('playerOverlay');
  const closePlayerBtn = document.getElementById('closePlayerBtn');
  const closePlayerIconBtn = document.getElementById('closePlayerIconBtn');
  const playerIframe = document.getElementById('playerIframe');
  const playerStreamTitle = document.getElementById('playerStreamTitle');
  const serverMenuBtn = document.getElementById('serverMenuBtn');
  const currentServerLabel = document.getElementById('currentServerLabel');
  const serverDropdownMenu = document.getElementById('serverDropdownMenu');
  const playerFullscreenBtn = document.getElementById('playerFullscreenBtn');
  const playerExtVlcBtn = document.getElementById('playerExtVlcBtn');
  const playerExtStremioBtn = document.getElementById('playerExtStremioBtn');
  const toast = document.getElementById('toast');

  // Screen Wake Lock & Body Scroll Lock
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      console.warn('WakeLock not supported or denied');
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  // Toast Notification
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Load Catalogs
  async function loadData() {
    try {
      const [moviesRes, seriesRes] = await Promise.all([
        fetch('/data/movies.json'),
        fetch('/data/series.json')
      ]);

      state.movies = await moviesRes.json();
      state.series = await seriesRes.json();

      renderHome();
    } catch (err) {
      console.error('Error loading catalogs:', err);
      showToast('Error cargando catálogo');
    }
  }

  // Render Home Experience
  function renderHome() {
    if (!state.movies.length && !state.series.length) return;

    // Pick Featured Hero
    const heroPool = [...state.movies.slice(0, 15), ...state.series.slice(0, 15)];
    const featured = heroPool[Math.floor(Math.random() * heroPool.length)];
    setupHero(featured);

    // Render Carousels
    const trending = [...state.movies.slice(0, 10), ...state.series.slice(0, 10)]
      .sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    
    trendingCount.textContent = `${trending.length} títulos`;
    renderCarousel(carouselTrending, trending);
    renderCarousel(carouselMovies, state.movies.slice(0, 30));
    renderCarousel(carouselSeries, state.series.slice(0, 30));

    // Filtered Carousels
    const actionItems = [...state.movies, ...state.series]
      .filter(item => item.genres && item.genres.some(g => /acción|aventura|action/i.test(g)))
      .slice(0, 25);
    renderCarousel(carouselAction, actionItems);

    const scifiItems = [...state.movies, ...state.series]
      .filter(item => item.genres && item.genres.some(g => /ciencia ficción|sci-fi|fantasía/i.test(g)))
      .slice(0, 25);
    renderCarousel(carouselSciFi, scifiItems);
  }

  // Setup Hero Banner
  function setupHero(item) {
    if (!item) return;
    const isMovie = item.id.startsWith('mov_');
    const typeLabel = isMovie ? 'movie' : 'series';

    heroBg.style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
    heroTitle.textContent = item.title;
    heroOverview.textContent = item.overview || 'Sinopsis disponible.';
    heroRating.textContent = item.rating || 'N/A';
    heroYear.textContent = item.releaseYear || '';

    heroPlayBtn.onclick = () => openWebPlayer(item, typeLabel, 1, 1);
    heroInfoBtn.onclick = () => openDetail(item, typeLabel);
  }

  // Render Single Media Card (No emojis, clean SVGs)
  function createMediaCard(item, type) {
    const card = document.createElement('div');
    card.className = 'media-card';
    const isMovie = type === 'movie' || item.id.startsWith('mov_');
    const itemType = isMovie ? 'movie' : 'series';

    card.innerHTML = `
      <div class="media-poster-box">
        <img class="media-poster" src="${item.posterUrl || ''}" alt="${item.title}" loading="lazy" onerror="this.src='/icons/icon-512.png'">
        <span class="media-rating-pill">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>${item.rating || 'N/A'}</span>
        </span>
        <span class="media-type-pill">${isMovie ? 'Película' : 'Serie'}</span>
        <button class="card-info-btn" title="Detalles y Sinopsis" aria-label="Detalles">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </div>
      <div class="media-info">
        <h4 class="media-title" title="${item.title}">${item.title}</h4>
        <div class="media-meta">
          <span>${item.releaseYear || ''}</span>
          <span>${(item.genres && item.genres[0]) || ''}</span>
        </div>
      </div>
    `;

    // Tap card anywhere -> Play directly!
    card.onclick = () => openWebPlayer(item, itemType, 1, 1);

    // Tap info icon -> Open detail dialog
    const infoBtn = card.querySelector('.card-info-btn');
    if (infoBtn) {
      infoBtn.onclick = (e) => {
        e.stopPropagation();
        openDetail(item, itemType);
      };
    }

    return card;
  }

  // Render Carousel
  function renderCarousel(container, items) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(item => {
      container.appendChild(createMediaCard(item));
    });
  }

  // Detail Modal Logic
  async function openDetail(item, type) {
    state.activeItem = item;
    state.activeType = type || (item.id.startsWith('mov_') ? 'movie' : 'series');
    state.currentSeason = 1;
    state.currentEpisode = 1;

    dialogPoster.src = item.posterUrl || '';
    dialogBackdrop.style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
    dialogTitle.textContent = item.title;
    dialogType.textContent = state.activeType === 'movie' ? 'Película' : 'Serie TV';
    dialogYear.textContent = item.releaseYear || '';
    dialogRating.textContent = item.rating || 'N/A';
    dialogOverview.textContent = item.overview || 'Sin sinopsis disponible.';

    // Genres
    dialogGenres.innerHTML = (item.genres || []).map(g => `<span>${g}</span>`).join('');

    // Update Favorite Button State
    updateFavButton();

    // Quick Play & Stremio Buttons
    if (quickPlayBtn) {
      quickPlayBtn.onclick = () => {
        openWebPlayer(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
      };
    }
    if (openInStremioQuickBtn) {
      openInStremioQuickBtn.onclick = () => {
        const queryId = state.activeItem.imdb_id || state.activeItem.id;
        window.location.href = `stremio:///detail/${state.activeType}/${queryId}`;
      };
    }

    // Series controls
    if (state.activeType === 'series') {
      seriesControls.style.display = 'flex';
      setupSeriesSelects();
    } else {
      seriesControls.style.display = 'none';
    }

    // Fetch Streams
    fetchStreams();

    // Open Modal and Lock Body Scroll
    document.body.classList.add('modal-open');
    detailDialog.showModal();
  }

  function setupSeriesSelects() {
    seasonSelect.innerHTML = '';
    for (let s = 1; s <= 6; s++) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Temporada ${s}`;
      seasonSelect.appendChild(opt);
    }
    seasonSelect.value = state.currentSeason;

    seasonSelect.onchange = (e) => {
      state.currentSeason = parseInt(e.target.value, 10);
      setupEpisodeSelect();
      fetchStreams();
    };

    setupEpisodeSelect();
  }

  function setupEpisodeSelect() {
    episodeSelect.innerHTML = '';
    for (let ep = 1; ep <= 16; ep++) {
      const opt = document.createElement('option');
      opt.value = ep;
      opt.textContent = `Episodio ${ep}`;
      episodeSelect.appendChild(opt);
    }
    episodeSelect.value = state.currentEpisode;

    episodeSelect.onchange = (e) => {
      state.currentEpisode = parseInt(e.target.value, 10);
      fetchStreams();
    };
  }

  // Fetch Streams from Vercel Serverless Function
  async function fetchStreams() {
    streamsList.innerHTML = `
      <div class="streams-loading">
        <div class="spinner"></div>
        <p>Buscando fuentes con el motor XuperTV...</p>
      </div>
    `;

    const item = state.activeItem;
    const type = state.activeType;
    let queryId = item.imdb_id || item.id;

    if (type === 'series') {
      queryId = `${queryId}:${state.currentSeason}:${state.currentEpisode}`;
    }

    try {
      const res = await fetch(`/api/stream?type=${type}&id=${encodeURIComponent(queryId)}`);
      const data = await res.json();
      const streams = data.streams || [];

      if (!streams.length) {
        streamsList.innerHTML = `
          <div class="streams-loading">
            <p>No se encontraron torrents activos para este título actualmente.</p>
            <p style="font-size: 0.8rem; margin-top: 4px; color: var(--text-dim);">Usa el botón Reproducir superior para ver la versión en streaming web.</p>
          </div>
        `;
        return;
      }

      renderStreams(streams);
    } catch (err) {
      console.error('Fetch streams error:', err);
      streamsList.innerHTML = `
        <div class="streams-loading">
          <p>Servicio de torrents temporalmente no disponible.</p>
        </div>
      `;
    }
  }

  // Render Streams List (Clean, disciplined Stremio style, no emojis)
  function renderStreams(streams) {
    streamsList.innerHTML = '';

    streams.forEach((stream, idx) => {
      const card = document.createElement('div');
      card.className = 'stream-card';

      const quality = stream.quality || '1080p FHD';
      const langText = stream.isSpanish ? 'Español Latino' : 'Multi-Audio';
      const seedsText = stream.seeds > 0 ? `${stream.seeds} fuentes` : '';
      const magnetUrl = stream.magnet || '';

      card.innerHTML = `
        <div class="stream-info">
          <div class="stream-header-row">
            <span class="stream-quality-tag">${quality}</span>
            <span class="stream-lang-tag">${langText}</span>
            ${seedsText ? `<span class="stream-seeds-tag">${seedsText}</span>` : ''}
          </div>
          <div class="stream-filename">Fuente ${idx + 1} &middot; ${quality}</div>
        </div>
        <div class="stream-actions">
          <button class="btn btn-sm btn-primary play-stream-btn">Ver</button>
          <button class="btn btn-sm btn-outline open-stremio-btn" title="Abrir en Stremio">Stremio</button>
          <button class="btn btn-sm btn-outline open-vlc-btn" title="Abrir en VLC">VLC</button>
          <button class="btn btn-sm btn-outline copy-magnet-btn" title="Copiar Magnet">Copiar</button>
        </div>
      `;

      // Actions
      const playBtn = card.querySelector('.play-stream-btn');
      const vlcBtn = card.querySelector('.open-vlc-btn');
      const stremioBtn = card.querySelector('.open-stremio-btn');
      const copyBtn = card.querySelector('.copy-magnet-btn');

      playBtn.onclick = () => {
        openWebPlayer(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
      };

      vlcBtn.onclick = () => {
        if (!magnetUrl) {
          showToast('No hay enlace magnet');
          return;
        }
        const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(magnetUrl)}`;
        window.location.href = vlcUrl;
        setTimeout(() => {
          window.location.href = magnetUrl;
        }, 1200);
      };

      stremioBtn.onclick = () => {
        const stremioUrl = `stremio:///detail/${state.activeType}/${state.activeItem.imdb_id || state.activeItem.id}`;
        window.location.href = stremioUrl;
      };

      copyBtn.onclick = () => {
        if (magnetUrl) {
          navigator.clipboard.writeText(magnetUrl).then(() => {
            showToast('Enlace magnet copiado');
          }).catch(() => {
            showToast('Error copiando magnet');
          });
        }
      };

      streamsList.appendChild(card);
    });
  }

  // Get Embed Player URL for High-Speed Streaming (Reliable Multi-Server)
  function getEmbedUrl(item, type, season = 1, episode = 1, server = 'multiembed') {
    const imdbId = item.imdb_id || item.id;
    const tmdbId = item.id.replace(/^(mov_|tv_)/, '');

    if (type === 'movie') {
      if (server === 'multiembed') return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&tmdb=1`;
      if (server === 'smashy') return `https://player.smashystream.com/movie/${imdbId || tmdbId}`;
      if (server === 'vidsrc') return `https://vidsrc.sh/embed/movie?imdb=${imdbId}`;
      if (server === '2embed') return `https://www.2embed.cc/embed/${imdbId}`;
      return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&tmdb=1`;
    } else {
      if (server === 'multiembed') return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&s=${season}&e=${episode}`;
      if (server === 'smashy') return `https://player.smashystream.com/tv/${imdbId || tmdbId}?s=${season}&e=${episode}`;
      if (server === 'vidsrc') return `https://vidsrc.sh/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
      if (server === '2embed') return `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`;
      return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&s=${season}&e=${episode}`;
    }
  }

  // Quick launch in VLC / Outplayer
  function triggerVlcLaunch() {
    const firstStreamCard = streamsList.querySelector('.stream-card');
    if (firstStreamCard) {
      const vlcBtn = firstStreamCard.querySelector('.open-vlc-btn');
      if (vlcBtn) {
        vlcBtn.click();
        return;
      }
    }
    showToast('Buscando enlaces para VLC...');
  }

  // Floating Cinema Overlay Auto-Hide Controller
  let overlayTimer = null;
  function showOverlay() {
    if (!playerOverlay) return;
    playerOverlay.classList.remove('hidden');
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      if (serverDropdownMenu && serverDropdownMenu.classList.contains('show')) return;
      playerOverlay.classList.add('hidden');
    }, 3500);
  }

  // In-App Web Video Streaming Logic (Instant Multi-Server Playback)
  function openWebPlayer(item, type, season = 1, episode = 1) {
    if (!item) return;
    state.activeItem = item;
    state.activeType = type;
    state.currentSeason = season;
    state.currentEpisode = episode;

    const seasonEpText = type === 'series' ? ` · T${season} E${episode}` : '';
    playerStreamTitle.textContent = `${item.title}${seasonEpText}`;

    // Configure External Links (if buttons exist)
    if (playerExtStremioBtn) {
      const queryId = item.imdb_id || item.id;
      playerExtStremioBtn.onclick = () => {
        window.location.href = `stremio:///detail/${type}/${queryId}`;
      };
    }

    if (playerExtVlcBtn) {
      playerExtVlcBtn.onclick = () => {
        triggerVlcLaunch();
      };
    }

    // Update Server Dropdown and Label
    const serverNames = {
      'multiembed': 'Español Latino',
      'smashy': 'Ultra Rápido HD',
      'vidsrc': 'Original + Subs',
      '2embed': 'Respaldo'
    };
    if (currentServerLabel) {
      currentServerLabel.textContent = serverNames[state.currentServer] || 'Español Latino';
    }
    document.querySelectorAll('.server-menu-item').forEach(m => {
      m.classList.toggle('active', m.dataset.server === state.currentServer);
    });

    const embedUrl = getEmbedUrl(item, type, season, episode, state.currentServer);
    playerIframe.src = embedUrl;

    // Completely hide the background app DOM so mobile Safari CANNOT slide or scroll behind the video!
    if (appContainer) {
      appContainer.style.display = 'none';
    }
    document.body.classList.add('player-open');
    requestWakeLock();
    playerDialog.showModal();
    showOverlay();
  }

  // Close Player
  function closePlayer() {
    releaseWakeLock();
    if (overlayTimer) clearTimeout(overlayTimer);
    if (serverDropdownMenu) serverDropdownMenu.classList.remove('show');
    
    // Restore background app DOM
    if (appContainer) {
      appContainer.style.display = '';
    }
    document.body.classList.remove('player-open');
    playerIframe.src = 'about:blank';
    playerDialog.close();
  }

  // Navigate to Home Smoothly
  function navigateHome() {
    // Close any open modals
    if (playerDialog.open) closePlayer();
    if (detailDialog.open) detailDialog.close();

    // Reset Search
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    searchResultsSection.style.display = 'none';
    favoritesSection.style.display = 'none';
    catalogSections.style.display = 'block';

    // Update active tab in Desktop and Mobile nav
    document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(b => {
      if (b.dataset.tab === 'discover') {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Favorite Management
  function updateFavButton() {
    if (!state.activeItem) return;
    const isFav = state.favorites.includes(state.activeItem.id);
    if (favBtnLabel) {
      favBtnLabel.textContent = isFav ? 'En Mi Lista' : 'Mi Lista';
    }
    dialogFavBtn.onclick = () => toggleFavorite(state.activeItem);
  }

  function toggleFavorite(item) {
    const idx = state.favorites.indexOf(item.id);
    if (idx > -1) {
      state.favorites.splice(idx, 1);
      showToast('Eliminado de Mi Lista');
    } else {
      state.favorites.push(item.id);
      showToast('Añadido a Mi Lista');
    }
    localStorage.setItem('xupertv_favs', JSON.stringify(state.favorites));
    updateFavButton();
    renderFavorites();
  }

  function renderFavorites() {
    const all = [...state.movies, ...state.series];
    const favItems = all.filter(it => state.favorites.includes(it.id));
    favoritesCount.textContent = `${favItems.length} títulos`;
    favoritesGrid.innerHTML = '';
    favItems.forEach(it => favoritesGrid.appendChild(createMediaCard(it)));
  }

  // Search Logic
  function handleSearch(query) {
    clearTimeout(state.searchDebounce);
    const q = query.trim().toLowerCase();

    if (searchClearBtn) {
      searchClearBtn.style.display = q ? 'block' : 'none';
    }

    state.searchDebounce = setTimeout(() => {
      if (!q) {
        searchResultsSection.style.display = 'none';
        catalogSections.style.display = 'block';
        return;
      }

      catalogSections.style.display = 'none';
      favoritesSection.style.display = 'none';
      searchResultsSection.style.display = 'block';

      const all = [...state.movies, ...state.series];
      const matches = all.filter(item => {
        const title = (item.title || '').toLowerCase();
        const overview = (item.overview || '').toLowerCase();
        const genres = (item.genres || []).join(' ').toLowerCase();
        return title.includes(q) || overview.includes(q) || genres.includes(q);
      });

      searchResultsTitle.textContent = `Resultados para "${query}" (${matches.length})`;
      searchResultsGrid.innerHTML = '';
      matches.forEach(item => searchResultsGrid.appendChild(createMediaCard(item)));
    }, 180);
  }

  // Switch Tab Handler
  function switchTab(tab) {
    document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(b => {
      if (b.dataset.tab === tab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (detailDialog.open) detailDialog.close();

    if (tab === 'discover') {
      navigateHome();
    } else if (tab === 'movies') {
      searchInput.value = '';
      catalogSections.style.display = 'none';
      favoritesSection.style.display = 'none';
      searchResultsSection.style.display = 'block';
      searchResultsTitle.textContent = `Películas (${state.movies.length})`;
      searchResultsGrid.innerHTML = '';
      state.movies.forEach(m => searchResultsGrid.appendChild(createMediaCard(m, 'movie')));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'series') {
      searchInput.value = '';
      catalogSections.style.display = 'none';
      favoritesSection.style.display = 'none';
      searchResultsSection.style.display = 'block';
      searchResultsTitle.textContent = `Series (${state.series.length})`;
      searchResultsGrid.innerHTML = '';
      state.series.forEach(s => searchResultsGrid.appendChild(createMediaCard(s, 'series')));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'search') {
      searchInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'favorites') {
      searchInput.value = '';
      catalogSections.style.display = 'none';
      searchResultsSection.style.display = 'none';
      favoritesSection.style.display = 'block';
      renderFavorites();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Desktop & Mobile Tab Listeners
  document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Home Brand Button Listener
  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', navigateHome);
  }

  // Modal Close Listeners
  detailDialog.addEventListener('click', (e) => {
    if (e.target === detailDialog) detailDialog.close();
  });
  detailDialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
  });
  closeDetailBtn.addEventListener('click', () => detailDialog.close());

  playerDialog.addEventListener('close', closePlayer);
  closePlayerBtn.addEventListener('click', closePlayer);
  if (closePlayerIconBtn) closePlayerIconBtn.addEventListener('click', closePlayer);

  // Fullscreen Button Logic with Mobile Safari Fallback
  if (playerFullscreenBtn) {
    playerFullscreenBtn.addEventListener('click', () => {
      const elem = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else {
          showToast('Gira el teléfono en horizontal');
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });
  }

  // Floating Cinema Overlay Interactions
  if (playerContainer) {
    playerContainer.addEventListener('mousemove', showOverlay);
    playerContainer.addEventListener('touchstart', showOverlay, { passive: true });
    playerContainer.addEventListener('click', showOverlay);
  }

  // Server Dropdown Menu Controller
  if (serverMenuBtn && serverDropdownMenu) {
    serverMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      serverDropdownMenu.classList.toggle('show');
      showOverlay();
    });

    document.querySelectorAll('.server-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const serverKey = item.dataset.server;
        state.currentServer = serverKey;
        document.querySelectorAll('.server-menu-item').forEach(m => m.classList.remove('active'));
        item.classList.add('active');

        const serverNames = {
          'multiembed': 'Español Latino',
          'smashy': 'Ultra Rápido HD',
          'vidsrc': 'Original + Subs',
          '2embed': 'Respaldo'
        };
        if (currentServerLabel) {
          currentServerLabel.textContent = serverNames[serverKey] || 'Servidor';
        }

        serverDropdownMenu.classList.remove('show');
        if (state.activeItem) {
          playerIframe.src = getEmbedUrl(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode, state.currentServer);
        }
        showOverlay();
      });
    });

    document.addEventListener('click', () => {
      if (serverDropdownMenu) serverDropdownMenu.classList.remove('show');
    });
  }

  // External Quick Launch Buttons in Detail Dialog
  if (openInStremioQuickBtn) {
    openInStremioQuickBtn.addEventListener('click', () => {
      if (!state.activeItem) return;
      const queryId = state.activeItem.imdb_id || state.activeItem.id;
      window.location.href = `stremio:///detail/${state.activeType}/${queryId}`;
    });
  }

  if (openInVlcQuickBtn) {
    openInVlcQuickBtn.addEventListener('click', triggerVlcLaunch);
  }

  // Screen WakeLock Recovery on Visibility / Rotation
  document.addEventListener('visibilitychange', () => {
    if (playerDialog.open && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  window.addEventListener('orientationchange', () => {
    if (playerDialog.open) {
      requestWakeLock();
    }
  });

  // Carousel Arrow Controls
  document.querySelectorAll('.carousel-arrow').forEach(arrow => {
    arrow.addEventListener('click', () => {
      const targetId = arrow.dataset.target;
      const track = document.getElementById(targetId);
      if (!track) return;
      const scrollAmount = arrow.classList.contains('left') ? -380 : 380;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  });

  // Search Listeners
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch('');
    });
  }
  clearSearchBtn.addEventListener('click', navigateHome);

  // Start Application
  loadData();
})();
