# XuperTV PWA — Plataforma Web de Streaming & Catálogo VOD (Estilo Netflix / Stremio)

Bienvenido a **XuperTV PWA**. Este repositorio contiene la implementación completa de la aplicación web progresiva (PWA) de streaming bajo demanda, diseñada con estética cinematográfica inspirada en Netflix, integración con Stremio y arquitectura multi-servidor para películas y series.

Este documento ha sido redactado exhaustivamente para proporcionar todo el contexto técnico, arquitectónico y operativo a **Claude** (o cualquier desarrollador/auditor de código) para una revisión técnica profunda del proyecto.

---

## 📌 1. Visión General y Objetivos del Proyecto

El objetivo de **XuperTV PWA** es ofrecer una experiencia de streaming ágil, moderna y sin fricciones en dispositivos móviles (especialmente Safari en iPhone/iOS) y de escritorio:

1. **Catálogo VOD Inmediato:** Visualización fluida de películas y series con metadatos oficiales (títulos, sinopsis, pósters en alta definición, año, calificación IMDb y géneros).
2. **Reproducción con 1 Toque:** Iniciar la reproducción instantánea al pulsar cualquier contenido sin recargas de página completas.
3. **Gestión de Series:** Selector visual de temporadas y episodios que permite elegir exactamente qué capítulo ver sin forzar la reproducción ciega del primer episodio.
4. **Integración con Stremio:** Enlace universal hacia **Stremio Web** (`web.stremio.com`) para usuarios que prefieren streaming torrent o reproductores externos.
5. **Experiencia Móvil iOS Optimizada:** Compatibilidad con gestos nativos de iOS (Swipe Back), soporte PWA para pantalla completa sin barra de direcciones, y controles táctiles de 44px según las *Apple Human Interface Guidelines*.

---

## 🏗️ 2. Arquitectura Técnica y Stack Tecnológico

La aplicación está construida con una filosofía de **Zero-Build Overhead** (Vanilla moderno, máxima velocidad de carga, sin dependencias pesadas de empaquetado):

* **Frontend:**
  * **HTML5:** Marcado semántico, uso de elementos nativos `<dialog>` para modales y reproductor in-app.
  * **CSS3:** Variables CSS (Design Tokens Netflix Pitch-Black: `#000000`, superficies `#141414`, acento rojo `#e50914`), Flexbox, CSS Grid, Media Queries adaptativas y soporte para `env(safe-area-inset-*)`.
  * **JavaScript (ES2022+):** Programación asíncrona modular, History API, Screen Wake Lock API.
* **Offline & PWA:**
  * **Web App Manifest (`manifest.json`):** Modo `standalone`, orientación `any`, color de tema `#000000`.
  * **Service Worker (`sw.js`):** Estrategia *Network-First* con versionado dinámico de caché para asegurar que las actualizaciones de código lleguen de inmediato a los clientes móviles sin quedarse atascadas en la caché de Safari.
* **Backend Serverless (Vercel):**
  * `api/stream.js`: Endpoint serverless en Node.js para resolución y scraping de fuentes torrent / streams de respaldo.
* **Despliegue y CI/CD:**
  * Repositorio GitHub: `https://github.com/axellnb/xupertv-pwa`
  * Despliegue automático en Vercel: `https://xupertv-pwa.vercel.app`

---

## 📂 3. Estructura del Repositorio

```text
XuperTV-PWA/
├── api/
│   └── stream.js            # Función serverless de Vercel para scraping de streams
├── public/
│   ├── data/
│   │   ├── movies.json      # Catálogo local de películas (186+ títulos con metadatos e IMDb IDs)
│   │   └── series.json      # Catálogo local de series (149+ títulos icónicos: Stranger Things, Breaking Bad, etc.)
│   ├── icons/
│   │   ├── icon.svg         # Icono vectorial oficial XuperTV
│   │   ├── icon-192.png     # Icono PWA para pantallas estándar
│   │   └── icon-512.png     # Icono PWA para pantallas de alta resolución
│   ├── app.js               # Controlador principal de lógica, reproductor, búsqueda y eventos
│   ├── index.html           # Estructura DOM de la aplicación, modales y reproductor dialog
│   ├── manifest.json        # Configuración de instalación PWA (iOS y Android)
│   ├── style.css            # Hoja de estilos cinematográfica (tema Netflix pitch-black)
│   └── sw.js                # Service Worker con estrategia network-first y purga de caché
├── .gitignore               # Exclusión de artefactos locales, logs y credenciales
├── package.json             # Manifiesto de Node.js y script de servidor local
├── README.md                # Esta documentación técnica
└── vercel.json              # Configuración de rutas, rewrites y cabeceras CORS de Vercel
```

---

## ⚙️ 4. Flujo de Funcionamiento Detallado

### A. Carga de Catálogo y Búsqueda Híbrida (Local + Cinemeta)
1. **Inicialización:** `app.js` realiza `Promise.all` para descargar en paralelo `data/movies.json` y `data/series.json`.
2. **Filtrado Local Inmediato:** Cuando el usuario teclea en el buscador, la app filtra instantáneamente la colección local sin retardo (`searchDebounce: 180ms`).
3. **Búsqueda Universal en Vivo:** Si la consulta tiene 2 o más caracteres, consulta en paralelo la API pública y sin autenticación de **Cinemeta (Stremio)**:
   * `https://v3-cinemeta.strem.io/catalog/series/top/search={query}.json`
   * `https://v3-cinemeta.strem.io/catalog/movie/top/search={query}.json`
4. Los resultados globales se normalizan al esquema interno y se agregan a la vista, garantizando que **cualquier serie, película o anime del mundo** pueda encontrarse y reproducirse aunque no esté pre-cargado en el JSON local.

### B. Reproductor in-App y Multi-Servidor
El reproductor in-app reside en un `<dialog id="playerDialog">` desacoplado del DOM principal:
* **Aislamiento en Reproducción:** Al abrirse, el contenedor `#app` se oculta (`display: 'none'`) para prevenir que Safari en iPhone permita desplazamientos o rebotes detrás del video.
* **Wake Lock:** Se activa `navigator.wakeLock.request('screen')` para evitar que la pantalla del móvil se apague durante la reproducción.
* **Servidores Disponibles:**
  1. **Servidor 1 (Ultra HD Estable - VidSrc):** `https://vidsrc.sh/embed/movie?imdb={imdb}` o `tv?imdb={imdb}&season={s}&episode={e}`.
  2. **Servidor 2 (Audio Latino - MultiEmbed):** `https://multiembed.mov/?video_id={imdb}&tmdb=1` (con parámetros `&s={s}&e={e}` en series).
  3. **Servidor 3 (Respaldo HD - 2Embed):** `https://www.2embed.cc/embed/{imdb}`.
  4. **Servidor 4 (Opcional - SmashyStream):** `https://player.smashystream.com/`.

### C. Navegación Segura de Salida (Anti-Atrapamiento en iOS)
Debido a que los iframes de terceros absorben todos los eventos táctiles del navegador, se implementaron medidas críticas:
* **Barra Superior Persistente:** `#playerOverlay` cuenta con `position: absolute; z-index: 9999; pointer-events: auto;`.
* **Botón `< Salir` y botón `✕`:** Tienen un tamaño mínimo de `44px` y manejan eventos tanto `click` como `touchend`.
* **Soporte de Gesto Swipe-Back:** Al iniciar la reproducción se ejecuta `history.pushState({ playerOpen: true }, '')`. El evento `popstate` escucha cuando el usuario desliza desde el borde izquierdo en Safari para cerrar el reproductor de forma natural.

---

## 🔍 5. Puntos Clave y Preguntas para la Revisión de Claude

Solicitamos a **Claude** que analice el código y preste especial atención a las siguientes áreas críticas:

### 1. Manejo de Servidores de Streaming vs. Captchas y Anuncios
* **Situación:** Los servidores web gratuitos basados en iframe (*VidSrc, MultiEmbed, 2Embed, Smashy*) integran protecciones anti-bot de Cloudflare (Turnstile/hCaptcha) y anuncios agresivos.
* **Pregunta para Claude:** ¿Qué estrategias recomiendas para evolucionar la entrega de video? 
  * ¿Es viable implementar un scraper/proxy en Node.js/Python que extraiga directamente las fuentes `.m3u8` (HLS) o `.mp4` limpias para alimentarlas a un `<video>` HTML5 nativo?
  * ¿Cómo se integraría un backend conectado a servicios Debrid (Real-Debrid, TorBox, AllDebrid) para obtener streams limpios en 4K/1080p sin anuncios ni captchas?

### 2. Restricciones de WebKit en iOS Safari
* **Situación:** Apple restringe el Fullscreen API estándar (`requestFullscreen`) en elementos arbitrarios del DOM en iPhone Safari (sólo permite `video.webkitEnterFullscreen()` o modo PWA Standalone).
* **Pregunta para Claude:** ¿Existen mejores prácticas para maximizar el área de visualización en Safari móvil y garantizar que el selector de pistas de audio y subtítulos no dependa del menú del iframe de terceros?

### 3. Migración a App Nativa (SwiftUI / Xcode) vs. PWA / Capacitor
* **Situación:** El usuario evalúa si vale la pena dar el salto a una aplicación nativa en Xcode para iPhone utilizando `AVPlayer` o `KSPlayer`.
* **Pregunta para Claude:** 
  * ¿Cuáles son las ventajas, desventajas y complejidad de empaquetar esta arquitectura con **Capacitor** frente a escribirla 100% en **SwiftUI**?
  * Si se pasa a SwiftUI, ¿cuál es la mejor arquitectura para replicar este catálogo con selector de episodios y reproducción directa de HLS/M3U8?

### 4. Modularidad y Calidad del Código (`app.js`)
* **Situación:** Actualmente `app.js` concentra la gestión de estado, renderizado DOM, debounce de búsqueda, controladores de reproductor y llamadas a API en aproximadamente 800 líneas de código limpio pero monolítico.
* **Pregunta para Claude:** ¿Qué refactorizaciones puntuales recomiendas para separar la capa de estado, la capa de servicios de streaming y la capa de componentes UI sin obligar a usar frameworks pesados (React/Angular)?

---

## 🚀 6. Guía de Ejecución Local y Despliegue

### Requisitos
* Node.js v18+ instalado.

### Ejecución Local
```bash
# Clonar el repositorio
git clone https://github.com/axellnb/xupertv-pwa.git
cd xupertv-pwa

# Iniciar servidor local
npm start
# O alternativamente con Python:
# python3 -m http.server 3000 --directory public
```
Abrir en el navegador: `http://localhost:3000` (o `http://localhost:5000`).

### Despliegue en Producción (Vercel)
El proyecto está vinculado al repositorio GitHub y se despliega automáticamente en cada push a la rama `main`:
```bash
git add .
git commit -m "feat: actualización"
git push origin main
```
URL de producción: [https://xupertv-pwa.vercel.app](https://xupertv-pwa.vercel.app)

---

## 📄 7. Licencia y Uso
Este software ha sido desarrollado con fines de investigación, análisis arquitectónico de aplicaciones streaming e ingeniería inversa educativa.
