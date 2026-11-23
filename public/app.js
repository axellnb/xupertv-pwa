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
    activeTorrent: null,
    wtClient: null,
    searchDebounce: null,
  };

  // DOM Elements
  const heroBanner = document.getElementById('heroBanner');
  const heroBg = document.getElementById('heroBg');
  const heroTitle = document.getElementById('heroTitle');
  const heroOverview = document.getElementById('heroOverview');
  const heroRating = document.getElementById('heroRating');
  const heroYear = document.getElementById('heroYear');
  const heroPlayBtn = document.getElementById('heroPlayBtn');
  const heroInfoBtn = document.getElementById('heroInfoBtn');

  const searchInput = document.getElementById('searchInput');
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
  const seriesControls = document.getElementById('seriesControls');
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  const streamsList = document.getElementById('streamsList');

  // Player
  const playerDialog = document.getElementById('playerDialog');
  const closePlayerBtn = document.getElementById('closePlayerBtn');
  const videoElement = document.getElementById('videoElement');
  const playerStreamTitle = document.getElementById('playerStreamTitle');
  const playerLoader = document.getElementById('playerLoader');
  const loaderStats = document.getElementById('loaderStats');
  const speedMetric = document.getElementById('speedMetric');
  const peersMetric = document.getElementById('peersMetric');
  const progressMetric = document.getElementById('progressMetric');
  const playerExtVlcBtn = document.getElementById('playerExtVlcBtn');
  const playerExtStremioBtn = document.getElementById('playerExtStremioBtn');
  const toast = document.getElementById('toast');

  // Initialize WebTorrent client
  if (typeof WebTorrent !== 'undefined') {
    try {
      state.wtClient = new WebTorrent();
    } catch (e) {
      console.warn('WebTorrent client initialization error:', e);
    }
  }

  // Toast Notification
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
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
      showToast('Error cargando catálogo de XuperTV');
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
    heroOverview.textContent = item.overview || 'Sinopsis disponible al reproducir.';
    heroRating.textContent = `⭐ ${item.rating || 'N/A'}`;
    heroYear.textContent = item.releaseYear || '';

    heroPlayBtn.onclick = () => openDetail(item, typeLabel);
    heroInfoBtn.onclick = () => openDetail(item, typeLabel);
  }

  // Render Single Media Card
  function createMediaCard(item, type) {
    const card = document.createElement('div');
    card.className = 'media-card';
    const isMovie = type === 'movie' || item.id.startsWith('mov_');
    const itemType = isMovie ? 'movie' : 'series';

    card.innerHTML = `
      <div class="media-poster-box">
        <img class="media-poster" src="${item.posterUrl || ''}" alt="${item.title}" loading="lazy" onerror="this.src='/icons/icon-512.png'">
        <span class="media-rating-pill">⭐ ${item.rating || 'N/A'}</span>
        <span class="media-type-pill">${isMovie ? 'Película' : 'Serie'}</span>
      </div>
      <div class="media-info">
        <h4 class="media-title" title="${item.title}">${item.title}</h4>
        <div class="media-meta">
          <span>${item.releaseYear || ''}</span>
          <span>${(item.genres && item.genres[0]) || ''}</span>
        </div>
      </div>
    `;

    card.onclick = () => openDetail(item, itemType);
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
    dialogRating.textContent = `⭐ ${item.rating || 'N/A'}`;
    dialogOverview.textContent = item.overview || 'Sin sinopsis disponible.';

    // Genres
    dialogGenres.innerHTML = (item.genres || []).map(g => `<span>${g}</span>`).join('');

    // Update Favorite Button State
    updateFavButton();

    // Series controls
    if (state.activeType === 'series') {
      seriesControls.style.display = 'flex';
      setupSeriesSelects();
    } else {
      seriesControls.style.display = 'none';
    }

    // Fetch Streams
    fetchStreams();

    // Open Modal
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
        <p>Buscando las mejores fuentes con el motor XuperTV...</p>
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
            <p style="font-size: 0.8rem; margin-top: 6px; color: var(--text-dim);">Prueba con otra temporada o película del catálogo.</p>
          </div>
        `;
        return;
      }

      renderStreams(streams);
    } catch (err) {
      console.error('Fetch streams error:', err);
      streamsList.innerHTML = `
        <div class="streams-loading">
          <p>Error conectando al servidor de streaming de XuperTV.</p>
        </div>
      `;
    }
  }

  // Render Streams List
  function renderStreams(streams) {
    streamsList.innerHTML = '';

    streams.forEach((stream, idx) => {
      const card = document.createElement('div');
      card.className = 'stream-card';

      const quality = stream.quality || '1080p';
      const langText = stream.isSpanish ? 'Español Latino / Multi' : 'Multi-Audio';
      const seedsText = stream.seeds > 0 ? `⚡ ${stream.seeds} semillas` : '';
      const magnetUrl = stream.magnet || '';

      card.innerHTML = `
        <div class="stream-info">
          <div class="stream-header-row">
            <span class="stream-quality-tag">${quality}</span>
            <span class="stream-lang-tag">${langText}</span>
            <span class="stream-seeds-tag">${seedsText}</span>
          </div>
          <div class="stream-filename">${stream.title ? stream.title.replace(/\n/g, ' ') : `Opción ${idx + 1}`}</div>
        </div>
        <div class="stream-actions">
          <button class="btn btn-sm btn-primary play-stream-btn">▶️ Reproducir</button>
          <button class="btn btn-sm btn-outline open-vlc-btn" title="Abrir en VLC / Outplayer">🍊 VLC</button>
          <button class="btn btn-sm btn-outline open-stremio-btn" title="Abrir en Stremio">🎬 Stremio</button>
          <button class="btn btn-sm btn-outline copy-magnet-btn" title="Copiar Magnet">📋</button>
        </div>
      `;

      // Actions
      const playBtn = card.querySelector('.play-stream-btn');
      const vlcBtn = card.querySelector('.open-vlc-btn');
      const stremioBtn = card.querySelector('.open-stremio-btn');
      const copyBtn = card.querySelector('.copy-magnet-btn');

      playBtn.onclick = () => startStreaming(stream);

      vlcBtn.onclick = () => {
        if (!magnetUrl) {
          showToast('No hay enlace magnet disponible');
          return;
        }
        // Universal iOS/macOS VLC & external player scheme
        const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(magnetUrl)}`;
        window.location.href = vlcUrl;
        setTimeout(() => {
          // Fallback to magnet
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
            showToast('✅ Enlace magnet copiado al portapapeles');
          }).catch(() => {
            showToast('Error copiando magnet');
          });
        }
      };

      streamsList.appendChild(card);
    });
  }

  // In-App Video Streaming Logic (WebTorrent + HTML5 Video)
  function startStreaming(stream) {
    const magnetUrl = stream.magnet;
    if (!magnetUrl) {
      showToast('Enlace no disponible para reproducción directa');
      return;
    }

    // Prepare Player Dialog
    playerStreamTitle.textContent = `${state.activeItem.title} (${stream.quality || 'HD'})`;
    playerLoader.style.display = 'block';
    playerLoaderText = document.getElementById('playerLoaderText');
    playerLoaderText.textContent = 'Buscando enjambre P2P y descargando metadatos...';
    loaderStats.textContent = 'Conectando a rastreadores de XuperTV...';
    speedMetric.textContent = '0 KB/s';
    peersMetric.textContent = '0';
    progressMetric.textContent = '0%';

    // Configure External Links
    playerExtVlcBtn.onclick = () => {
      window.location.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(magnetUrl)}`;
    };
    playerExtStremioBtn.onclick = () => {
      window.location.href = `stremio:///detail/${state.activeType}/${state.activeItem.imdb_id || state.activeItem.id}`;
    };

    playerDialog.showModal();

    // Reset previous torrent
    if (state.activeTorrent) {
      try {
        state.activeTorrent.destroy();
      } catch (e) {}
      state.activeTorrent = null;
    }

    if (!state.wtClient) {
      loaderStats.textContent = 'WebTorrent no compatible con este navegador. Usa el botón "Abrir en VLC".';
      return;
    }

    try {
      state.wtClient.add(magnetUrl, (torrent) => {
        state.activeTorrent = torrent;

        // Find video file
        const videoFile = torrent.files.find(f => {
          const name = f.name.toLowerCase();
          return name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.webm') || name.endsWith('.avi');
        }) || torrent.files[0];

        if (videoFile) {
          loaderStats.textContent = `Archivo: ${videoFile.name} (${(videoFile.length / 1024 / 1024).toFixed(0)} MB)`;
          
          videoFile.renderTo(videoElement, {
            autoplay: true,
            controls: true
          }, (err) => {
            if (err) {
              console.warn('Render error:', err);
              loaderStats.textContent = 'Formato de video requiere reproductor externo (VLC / Outplayer).';
            } else {
              playerLoader.style.display = 'none';
            }
          });
        }

        // Live Torrent Progress Listener
        torrent.on('download', () => {
          const speed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
          const peers = torrent.numPeers;
          const prog = (torrent.progress * 100).toFixed(1);

          speedMetric.textContent = `${speed} MB/s`;
          peersMetric.textContent = peers;
          progressMetric.textContent = `${prog}%`;

          if (videoElement.currentTime > 0) {
            playerLoader.style.display = 'none';
          }
        });
      });
    } catch (err) {
      console.error('Torrent add error:', err);
      loaderStats.textContent = 'Error al procesar el stream. Usa "Abrir en VLC".';
    }
  }

  // Close Player
  function closePlayer() {
    if (state.activeTorrent) {
      try {
        state.activeTorrent.destroy();
      } catch (e) {}
      state.activeTorrent = null;
    }
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    playerDialog.close();
  }

  // Favorite Management
  function updateFavButton() {
    if (!state.activeItem) return;
    const isFav = state.favorites.includes(state.activeItem.id);
    dialogFavBtn.textContent = isFav ? '❤️' : '🤍';
    dialogFavBtn.onclick = () => toggleFavorite(state.activeItem);
  }

  function toggleFavorite(item) {
    const idx = state.favorites.indexOf(item.id);
    if (idx > -1) {
      state.favorites.splice(idx, 1);
      showToast('Eliminado de favoritos');
    } else {
      state.favorites.push(item.id);
      showToast('Guardado en favoritos');
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

  // Search
  function handleSearch(query) {
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(() => {
      const q = query.trim().toLowerCase();
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
    }, 200);
  }

  // Tab Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;

      searchInput.value = '';
      searchResultsSection.style.display = 'none';

      if (tab === 'discover') {
        catalogSections.style.display = 'block';
        favoritesSection.style.display = 'none';
      } else if (tab === 'movies') {
        catalogSections.style.display = 'none';
        favoritesSection.style.display = 'none';
        searchResultsSection.style.display = 'block';
        searchResultsTitle.textContent = `Películas XuperTV (${state.movies.length})`;
        searchResultsGrid.innerHTML = '';
        state.movies.forEach(m => searchResultsGrid.appendChild(createMediaCard(m, 'movie')));
      } else if (tab === 'series') {
        catalogSections.style.display = 'none';
        favoritesSection.style.display = 'none';
        searchResultsSection.style.display = 'block';
        searchResultsTitle.textContent = `Series XuperTV (${state.series.length})`;
        searchResultsGrid.innerHTML = '';
        state.series.forEach(s => searchResultsGrid.appendChild(createMediaCard(s, 'series')));
      } else if (tab === 'favorites') {
        catalogSections.style.display = 'none';
        searchResultsSection.style.display = 'none';
        favoritesSection.style.display = 'block';
        renderFavorites();
      }
    });
  });

  // Modern Web Guidance: Light Dismiss implementation for <dialog>
  detailDialog.addEventListener('click', (e) => {
    if (e.target === detailDialog) {
      detailDialog.close();
    }
  });

  closeDetailBtn.addEventListener('click', () => {
    detailDialog.close();
  });

  closePlayerBtn.addEventListener('click', closePlayer);

  // Carousel Arrow Controls
  document.querySelectorAll('.carousel-arrow').forEach(arrow => {
    arrow.addEventListener('click', () => {
      const targetId = arrow.dataset.target;
      const track = document.getElementById(targetId);
      if (!track) return;
      const scrollAmount = arrow.classList.contains('left') ? -450 : 450;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  });

  // Search Input Listeners
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchResultsSection.style.display = 'none';
    catalogSections.style.display = 'block';
  });

  // Start Application
  loadData();
})();
