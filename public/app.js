// XuperTV PWA Engine & Stremio Client
(() => {
  // Safe LocalStorage Helper (Prevents crash if corrupted)
  function getSafeStorage(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setSafeStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  // HTML Entity Sanitizer (Prevents XSS in dynamic templates)
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Series Metadata Memory Cache
  const seriesMetaCache = new Map();

  // Application State
  const state = {
    movies: [],
    series: [],
    favorites: getSafeStorage('xupertv_favs', []),
    continueWatching: getSafeStorage('xupertv_history', []),
    debridToken: localStorage.getItem('xupertv_debrid_token') || '',
    activeItem: null,
    activeType: 'movie',
    currentSeason: 1,
    currentEpisode: 1,
    currentServer: localStorage.getItem('xupertv_last_server') || 'vidsrc',
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

  // Continue Watching Elements
  const continueWatchingSection = document.getElementById('continueWatchingSection');
  const carouselContinue = document.getElementById('carouselContinue');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Category Tab Views with Genre Pills
  const tabCatalogSection = document.getElementById('tabCatalogSection');
  const tabCatalogTitle = document.getElementById('tabCatalogTitle');
  const tabCatalogCount = document.getElementById('tabCatalogCount');
  const tabGenreFilter = document.getElementById('tabGenreFilter');
  const tabCatalogGrid = document.getElementById('tabCatalogGrid');

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
  const appContainer = document.getElementById('app');
  const seriesControls = document.getElementById('seriesControls');
  const seasonSelect = document.getElementById('seasonSelect');
  const episodesGrid = document.getElementById('episodesGrid');
  const streamsList = document.getElementById('streamsList');

  // Player
  const playerDialog = document.getElementById('playerDialog');
  const playerContainer = document.getElementById('playerContainer');
  const playerOverlay = document.getElementById('playerOverlay');
  const closePlayerBtn = document.getElementById('closePlayerBtn');
  const playerIframe = document.getElementById('playerIframe');
  const nativeVideoPlayer = document.getElementById('nativeVideoPlayer');
  const playerStreamTitle = document.getElementById('playerStreamTitle');
  const serverMenuBtn = document.getElementById('serverMenuBtn');
  const currentServerLabel = document.getElementById('currentServerLabel');
  const serverDropdownMenu = document.getElementById('serverDropdownMenu');
  const playerFullscreenBtn = document.getElementById('playerFullscreenBtn');
  const toast = document.getElementById('toast');

  // Settings / Debrid Modal
  const settingsDialog = document.getElementById('settingsDialog');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const debridTokenInput = document.getElementById('debridTokenInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const removeSettingsBtn = document.getElementById('removeSettingsBtn');

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
    renderContinueWatching();
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

  // Continue Watching History Controller
  function saveWatchProgress(item, type, season = 1, episode = 1) {
    if (!item) return;
    const progressItem = {
      id: item.id,
      title: item.title,
      posterUrl: item.posterUrl || '',
      type: type || (item.id.startsWith('mov_') ? 'movie' : 'series'),
      season: type === 'series' ? season : null,
      episode: type === 'series' ? episode : null,
      rating: item.rating || '',
      releaseYear: item.releaseYear || '',
      imdb_id: item.imdb_id || item.id,
      timestamp: Date.now()
    };

    // Remove older entry if exists
    state.continueWatching = state.continueWatching.filter(it => it.id !== item.id);
    state.continueWatching.unshift(progressItem);
    if (state.continueWatching.length > 15) {
      state.continueWatching.pop();
    }
    setSafeStorage('xupertv_history', state.continueWatching);
    renderContinueWatching();
  }

  function renderContinueWatching() {
    if (!continueWatchingSection || !carouselContinue) return;
    if (!state.continueWatching || state.continueWatching.length === 0) {
      continueWatchingSection.style.display = 'none';
      return;
    }

    continueWatchingSection.style.display = 'block';
    carouselContinue.innerHTML = '';

    state.continueWatching.forEach(item => {
      const card = document.createElement('div');
      card.className = 'continue-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const safeTitle = escapeHtml(item.title);
      const safePoster = escapeHtml(item.posterUrl || '');
      const badgeText = item.type === 'series' ? `T${item.season} · E${item.episode}` : 'Película';

      card.innerHTML = `
        <div class="media-poster-box">
          <img class="media-poster" src="${safePoster}" alt="${safeTitle}" loading="lazy" onerror="this.src='/icons/icon-512.png'">
          <span class="continue-badge">${badgeText}</span>
        </div>
        <div class="continue-progress-bar">
          <div class="continue-progress-fill" style="width: 70%;"></div>
        </div>
        <div class="media-info" style="padding: 4px 2px 2px;">
          <h4 class="media-title" title="${safeTitle}">${safeTitle}</h4>
        </div>
      `;

      card.onclick = () => {
        openWebPlayer(item, item.type, item.season || 1, item.episode || 1);
      };

      carouselContinue.appendChild(card);
    });
  }

  // Render Single Media Card (XSS-Safe, accessible, uniform tap behavior)
  function createMediaCard(item, type) {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const isMovie = type === 'movie' || (item.id && item.id.startsWith('mov_'));
    const itemType = isMovie ? 'movie' : 'series';

    const safeTitle = escapeHtml(item.title);
    const safePoster = escapeHtml(item.posterUrl || '');
    const rawRating = item.rating ? String(item.rating).trim() : '';
    const showRating = (rawRating && rawRating !== '0.0' && rawRating !== '0' && rawRating !== 'N/A');
    const safeYear = escapeHtml(item.releaseYear || '');
    const firstGenre = (item.genres && item.genres[0]) ? escapeHtml(item.genres[0]) : '';

    card.innerHTML = `
      <div class="media-poster-box">
        <img class="media-poster" src="${safePoster}" alt="${safeTitle}" loading="lazy" onerror="this.src='/icons/icon-512.png'">
        ${showRating ? `
        <span class="media-rating-pill">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>${escapeHtml(rawRating)}</span>
        </span>` : ''}
        <span class="media-type-pill">${isMovie ? 'Película' : 'Serie'}</span>
      </div>
      <div class="media-info">
        <h4 class="media-title" title="${safeTitle}">${safeTitle}</h4>
        <div class="media-meta">
          <span>${safeYear}</span>
          <span>${firstGenre}</span>
        </div>
      </div>
    `;

    // Tapping ANY card opens the detail dialog (prevents accidental video playback while scrolling on mobile)
    const handleCardClick = () => openDetail(item, itemType);
    card.onclick = handleCardClick;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick();
      }
    };

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
        openInStremio(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
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

  // Series Episodes & Real Metadata Mapping
  async function setupSeriesSelects() {
    const item = state.activeItem;
    const imdbId = item.imdb_id;
    seasonSelect.innerHTML = '<option value="1">Cargando temporadas...</option>';
    episodesGrid.innerHTML = '<div style="padding:10px; color:#888; font-size:0.8rem;">Consultando capítulos oficiales...</div>';

    let videos = null;
    if (imdbId && imdbId.startsWith('tt')) {
      if (seriesMetaCache.has(imdbId)) {
        videos = seriesMetaCache.get(imdbId);
      } else {
        try {
          const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(imdbId)}.json`);
          const data = await res.json();
          if (data && data.meta && Array.isArray(data.meta.videos) && data.meta.videos.length > 0) {
            videos = data.meta.videos;
            seriesMetaCache.set(imdbId, videos);
          }
        } catch (_) {}
      }
    }

    // Build real seasons and episodes structure
    const seasonMap = new Map();
    if (videos && videos.length > 0) {
      videos.forEach(v => {
        const s = v.season;
        const e = v.episode;
        if (s && e) {
          if (!seasonMap.has(s)) seasonMap.set(s, []);
          seasonMap.get(s).push(v);
        }
      });
    }

    // Fallback if metadata not available
    if (seasonMap.size === 0) {
      for (let s = 1; s <= 5; s++) {
        const eps = [];
        for (let e = 1; e <= 12; e++) {
          eps.push({ season: s, episode: e, name: `Episodio ${e}` });
        }
        seasonMap.set(s, eps);
      }
    }

    // Populate season select with real counts
    seasonSelect.innerHTML = '';
    const sortedSeasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);
    sortedSeasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      const count = seasonMap.get(s).length;
      opt.textContent = `Temporada ${s} (${count} eps)`;
      seasonSelect.appendChild(opt);
    });

    state.currentSeason = sortedSeasons.includes(state.currentSeason) ? state.currentSeason : sortedSeasons[0];
    seasonSelect.value = state.currentSeason;

    seasonSelect.onchange = (e) => {
      state.currentSeason = parseInt(e.target.value, 10);
      state.currentEpisode = 1;
      renderEpisodesGrid(seasonMap.get(state.currentSeason) || []);
      updateQuickPlayText();
      fetchStreams();
    };

    renderEpisodesGrid(seasonMap.get(state.currentSeason) || []);
    updateQuickPlayText();
  }

  function updateQuickPlayText() {
    if (quickPlayBtn) {
      quickPlayBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Reproducir T${state.currentSeason} · E${state.currentEpisode}
      `;
    }
  }

  function renderEpisodesGrid(episodesList) {
    if (!episodesGrid) return;
    episodesGrid.innerHTML = '';

    episodesList.forEach(v => {
      const epNum = v.episode;
      const btn = document.createElement('button');
      btn.className = `ep-btn ${epNum === state.currentEpisode ? 'active' : ''}`;
      btn.textContent = `E${epNum}`;
      btn.title = v.name || `Episodio ${epNum}`;
      btn.onclick = () => {
        state.currentEpisode = epNum;
        document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateQuickPlayText();
        fetchStreams();
      };
      episodesGrid.appendChild(btn);
    });
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

  // Open directly in official Stremio Web / App (Universal iOS & Desktop)
  function openInStremio(item, type, season = 1, episode = 1) {
    if (!item) return;
    const imdbId = item.imdb_id;
    if (imdbId && imdbId.startsWith('tt')) {
      if (type === 'series') {
        window.open(`https://web.stremio.com/#/detail/series/${imdbId}/${season}:${episode}`, '_blank');
      } else {
        window.open(`https://web.stremio.com/#/detail/movie/${imdbId}`, '_blank');
      }
    } else {
      window.open(`https://web.stremio.com/#/search?search=${encodeURIComponent(item.title)}`, '_blank');
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
          <button class="btn btn-sm btn-outline copy-magnet-btn" title="Copiar Magnet">Copiar</button>
        </div>
      `;

      // Actions
      const playBtn = card.querySelector('.play-stream-btn');
      const stremioBtn = card.querySelector('.open-stremio-btn');
      const copyBtn = card.querySelector('.copy-magnet-btn');

      if (state.debridToken && magnetUrl) {
        playBtn.textContent = '⚡ Debrid 4K';
        playBtn.title = 'Reproducir directo sin anuncios ni captchas vía Debrid';
      }

      playBtn.onclick = async () => {
        if (state.debridToken && magnetUrl) {
          showToast('Desbloqueando stream de alta velocidad...');
          try {
            const res = await fetch(`/api/debrid?token=${encodeURIComponent(state.debridToken)}&magnet=${encodeURIComponent(magnetUrl)}`);
            const data = await res.json();
            if (data && data.streamUrl) {
              const epText = state.activeType === 'series' ? ` · T${state.currentSeason} E${state.currentEpisode}` : '';
              playDirectVideo(data.streamUrl, `${state.activeItem.title}${epText} (${quality})`);
              saveWatchProgress(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
              return;
            } else if (data && data.error) {
              showToast(data.error);
            }
          } catch (err) {
            console.warn('Debrid unrestrict failed:', err);
            showToast('Fallo al desbloquear Debrid, abriendo streaming web...');
          }
        }
        openWebPlayer(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
      };

      stremioBtn.onclick = () => {
        openInStremio(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
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
  function getEmbedUrl(item, type, season = 1, episode = 1, server = 'vidsrc') {
    const imdbId = item.imdb_id || item.id;
    const tmdbId = item.id.replace(/^(mov_|tv_)/, '');

    if (type === 'movie') {
      if (server === 'vidsrc') return `https://vidsrc.sh/embed/movie?imdb=${imdbId}`;
      if (server === 'multiembed') return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&tmdb=1`;
      if (server === '2embed') return `https://www.2embed.cc/embed/${imdbId}`;
      if (server === 'smashy') return `https://player.smashystream.com/movie/${imdbId || tmdbId}`;
      return `https://vidsrc.sh/embed/movie?imdb=${imdbId}`;
    } else {
      if (server === 'vidsrc') return `https://vidsrc.sh/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
      if (server === 'multiembed') return `https://multiembed.mov/?video_id=${imdbId || tmdbId}&s=${season}&e=${episode}`;
      if (server === '2embed') return `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`;
      if (server === 'smashy') return `https://player.smashystream.com/tv/${imdbId || tmdbId}?s=${season}&e=${episode}`;
      return `https://vidsrc.sh/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
    }
  }

  // Floating Cinema Top Bar Controller (Auto-hiding overlay)
  let overlayTimer = null;
  function resetOverlayTimer() {
    if (!playerOverlay) return;
    playerOverlay.classList.remove('hidden');
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      // Keep visible if server dropdown is open
      if (serverDropdownMenu && serverDropdownMenu.classList.contains('show')) return;
      playerOverlay.classList.add('hidden');
    }, 3800);
  }

  function showOverlay() {
    resetOverlayTimer();
  }

  // Direct HTML5 Video Player (Debrid / Direct MP4 / M3U8 without iframes or ads)
  function playDirectVideo(url, title) {
    if (!url) return;
    playerStreamTitle.textContent = title || 'Reproduciendo';

    if (playerIframe) {
      playerIframe.style.display = 'none';
      playerIframe.src = 'about:blank';
    }

    if (nativeVideoPlayer) {
      nativeVideoPlayer.style.display = 'block';
      nativeVideoPlayer.src = url;
      nativeVideoPlayer.play().catch(e => console.warn('Autoplay prevented:', e));
    }

    if (appContainer) {
      appContainer.style.display = 'none';
    }
    document.body.classList.add('player-open');
    requestWakeLock();
    try {
      history.pushState({ playerOpen: true }, '');
    } catch (_) {}
    playerDialog.showModal();
    showOverlay();
  }

  // In-App Web Video Streaming Logic (Instant Multi-Server Playback)
  function openWebPlayer(item, type, season = 1, episode = 1) {
    if (!item) return;
    state.activeItem = item;
    state.activeType = type;
    state.currentSeason = season;
    state.currentEpisode = episode;

    // Track Progress in Continue Watching
    saveWatchProgress(item, type, season, episode);

    const seasonEpText = type === 'series' ? ` · T${season} E${episode}` : '';
    playerStreamTitle.textContent = `${item.title}${seasonEpText}`;

    // Update Server Dropdown and Label
    const serverNames = {
      'vidsrc': 'Servidor 1 (Ultra HD)',
      'multiembed': 'Servidor 2 (Latino)',
      '2embed': 'Servidor 3 (Respaldo)',
      'smashy': 'Servidor 4 (Opcional)'
    };
    if (currentServerLabel) {
      currentServerLabel.textContent = serverNames[state.currentServer] || 'Servidor 1 (Ultra HD)';
    }
    document.querySelectorAll('.server-menu-item').forEach(m => {
      m.classList.toggle('active', m.dataset.server === state.currentServer);
    });

    if (nativeVideoPlayer) {
      nativeVideoPlayer.pause();
      nativeVideoPlayer.src = '';
      nativeVideoPlayer.style.display = 'none';
    }

    const embedUrl = getEmbedUrl(item, type, season, episode, state.currentServer);
    if (playerIframe) {
      playerIframe.style.display = 'block';
      playerIframe.src = embedUrl;
    }

    // Completely hide the background app DOM so mobile Safari CANNOT slide or scroll behind the video!
    if (appContainer) {
      appContainer.style.display = 'none';
    }
    document.body.classList.add('player-open');
    requestWakeLock();
    try {
      history.pushState({ playerOpen: true }, '');
    } catch (_) {}
    playerDialog.showModal();
    showOverlay();
  }

  // Close Player and Exit Cleanly
  function closePlayer(triggerHistory = true) {
    clearTimeout(overlayTimer);
    releaseWakeLock();
    if (serverDropdownMenu) serverDropdownMenu.classList.remove('show');
    
    // Restore background app DOM
    if (appContainer) {
      appContainer.style.display = '';
    }
    document.body.classList.remove('player-open');
    if (nativeVideoPlayer) {
      nativeVideoPlayer.pause();
      nativeVideoPlayer.src = '';
      nativeVideoPlayer.style.display = 'none';
    }
    if (playerIframe) {
      playerIframe.src = 'about:blank';
    }
    if (playerDialog.open) {
      playerDialog.close();
    }
    if (triggerHistory && history.state && history.state.playerOpen) {
      try {
        history.back();
      } catch (_) {}
    }
  }

  // Navigate to Home Smoothly
  function navigateHome() {
    // Close any open modals
    if (playerDialog.open) closePlayer();
    if (detailDialog.open) detailDialog.close();
    if (settingsDialog && settingsDialog.open) settingsDialog.close();

    // Reset Views
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    searchResultsSection.style.display = 'none';
    favoritesSection.style.display = 'none';
    if (tabCatalogSection) tabCatalogSection.style.display = 'none';
    catalogSections.style.display = 'block';

    renderContinueWatching();

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
    setSafeStorage('xupertv_favs', state.favorites);
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

  // Search Logic with AbortController, Cache & Clean Title Matching
  let searchAbortController = null;
  const searchCache = new Map();

  function handleSearch(query) {
    clearTimeout(state.searchDebounce);
    if (searchAbortController) {
      searchAbortController.abort();
    }

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

      // Match primarily by title or genres (reduces synopsis noise)
      const all = [...state.movies, ...state.series];
      const matches = all.filter(item => {
        const title = (item.title || '').toLowerCase();
        const genres = (item.genres || []).join(' ').toLowerCase();
        return title.includes(q) || genres.includes(q);
      });

      searchResultsTitle.textContent = `Resultados para "${query}" (${matches.length})`;
      searchResultsGrid.innerHTML = '';
      matches.forEach(item => searchResultsGrid.appendChild(createMediaCard(item)));

      // Universal Online Search with AbortController & Cache
      if (q.length >= 2) {
        if (searchCache.has(q)) {
          appendOnlineResults(searchCache.get(q), matches, query);
          return;
        }

        searchAbortController = new AbortController();
        const signal = searchAbortController.signal;

        Promise.all([
          fetch(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(q)}.json`, { signal }).then(r => r.json()).catch(() => ({ metas: [] })),
          fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`, { signal }).then(r => r.json()).catch(() => ({ metas: [] }))
        ]).then(([seriesRes, moviesRes]) => {
          if (signal.aborted || searchInput.value.trim().toLowerCase() !== q) return;
          const onlineMetas = [...(seriesRes.metas || []), ...(moviesRes.metas || [])];
          searchCache.set(q, onlineMetas);
          appendOnlineResults(onlineMetas, matches, query);
        }).catch(() => {});
      }
    }, 200);
  }

  function appendOnlineResults(onlineMetas, matches, query) {
    const existingIds = new Set(matches.map(m => m.imdb_id || m.id));
    onlineMetas.forEach(m => {
      const mId = m.imdb_id || m.id;
      if (mId && !existingIds.has(mId)) {
        existingIds.add(mId);
        const mappedItem = {
          id: (m.type === 'series' ? 'tv_' : 'mov_') + mId,
          title: m.name,
          overview: m.description || '',
          posterUrl: m.poster || '',
          backdropUrl: m.background || m.poster || '',
          releaseYear: parseInt(m.releaseInfo || m.year, 10) || '',
          rating: m.imdbRating || '',
          genres: m.genres || [m.type === 'series' ? 'Serie' : 'Película'],
          imdb_id: mId
        };
        matches.push(mappedItem);
        searchResultsGrid.appendChild(createMediaCard(mappedItem));
      }
    });
    searchResultsTitle.textContent = `Resultados para "${query}" (${matches.length})`;
  }

  // Open Dynamic Category View with Genre Filter Chips
  function openCategoryView(type) {
    if (!tabCatalogSection) return;
    searchInput.value = '';
    catalogSections.style.display = 'none';
    favoritesSection.style.display = 'none';
    searchResultsSection.style.display = 'none';
    tabCatalogSection.style.display = 'block';

    const items = type === 'movie' ? state.movies : state.series;
    const title = type === 'movie' ? 'Películas' : 'Series';
    tabCatalogTitle.textContent = title;
    tabCatalogCount.textContent = `${items.length} títulos`;

    // Extract unique genres
    const genreSet = new Set();
    items.forEach(it => {
      (it.genres || []).forEach(g => {
        if (g && g.trim()) genreSet.add(g.trim());
      });
    });

    const genresList = ['Todos', ...Array.from(genreSet).sort()];

    // Render genre chips
    tabGenreFilter.innerHTML = '';
    let selectedGenre = 'Todos';

    const renderFilteredGrid = () => {
      const filtered = selectedGenre === 'Todos' 
        ? items 
        : items.filter(it => (it.genres || []).includes(selectedGenre));
      
      tabCatalogCount.textContent = `${filtered.length} títulos`;
      tabCatalogGrid.innerHTML = '';
      filtered.forEach(it => tabCatalogGrid.appendChild(createMediaCard(it, type)));
    };

    genresList.forEach(g => {
      const chip = document.createElement('button');
      chip.className = `genre-chip ${g === selectedGenre ? 'active' : ''}`;
      chip.textContent = g;
      chip.onclick = () => {
        selectedGenre = g;
        tabGenreFilter.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderFilteredGrid();
      };
      tabGenreFilter.appendChild(chip);
    });

    renderFilteredGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      openCategoryView('movie');
    } else if (tab === 'series') {
      openCategoryView('series');
    } else if (tab === 'search') {
      catalogSections.style.display = 'none';
      favoritesSection.style.display = 'none';
      if (tabCatalogSection) tabCatalogSection.style.display = 'none';
      searchResultsSection.style.display = 'block';
      searchInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'favorites') {
      searchInput.value = '';
      catalogSections.style.display = 'none';
      searchResultsSection.style.display = 'none';
      if (tabCatalogSection) tabCatalogSection.style.display = 'none';
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

  playerDialog.addEventListener('close', () => closePlayer(false));

  const handlePlayerExit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closePlayer();
  };
  closePlayerBtn.addEventListener('click', handlePlayerExit);
  closePlayerBtn.addEventListener('touchend', handlePlayerExit);

  // Mobile Back-Swipe / History Back Navigation to Exit Video
  window.addEventListener('popstate', () => {
    if (playerDialog && playerDialog.open) {
      closePlayer(false);
    }
  });

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
        try { localStorage.setItem('xupertv_last_server', serverKey); } catch (_) {}
        document.querySelectorAll('.server-menu-item').forEach(m => m.classList.remove('active'));
        item.classList.add('active');

        const serverNames = {
          'vidsrc': 'Servidor 1 (Ultra HD)',
          'multiembed': 'Servidor 2 (Latino)',
          '2embed': 'Servidor 3 (Respaldo)',
          'smashy': 'Servidor 4 (Opcional)'
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

  // Clear Continue Watching History
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      state.continueWatching = [];
      setSafeStorage('xupertv_history', []);
      renderContinueWatching();
      showToast('Historial borrado');
    });
  }

  // Settings & Debrid Dialog Controller
  if (openSettingsBtn && settingsDialog) {
    openSettingsBtn.addEventListener('click', () => {
      if (debridTokenInput) debridTokenInput.value = state.debridToken || '';
      settingsDialog.showModal();
    });
  }

  if (closeSettingsBtn && settingsDialog) {
    closeSettingsBtn.addEventListener('click', () => settingsDialog.close());
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const token = debridTokenInput ? debridTokenInput.value.trim() : '';
      state.debridToken = token;
      try {
        if (token) localStorage.setItem('xupertv_debrid_token', token);
        else localStorage.removeItem('xupertv_debrid_token');
      } catch (_) {}
      showToast(token ? 'Token Debrid guardado' : 'Token eliminado');
      if (settingsDialog) settingsDialog.close();
    });
  }

  if (removeSettingsBtn) {
    removeSettingsBtn.addEventListener('click', () => {
      state.debridToken = '';
      if (debridTokenInput) debridTokenInput.value = '';
      try {
        localStorage.removeItem('xupertv_debrid_token');
      } catch (_) {}
      showToast('Token eliminado');
      if (settingsDialog) settingsDialog.close();
    });
  }

  // External Quick Launch Buttons in Detail Dialog
  if (openInStremioQuickBtn) {
    openInStremioQuickBtn.addEventListener('click', () => {
      openInStremio(state.activeItem, state.activeType, state.currentSeason, state.currentEpisode);
    });
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
