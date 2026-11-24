// Vercel Serverless Function: Debrid Stream Resolver (Supports TorBox & Real-Debrid)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { token, magnet } = req.query;
  if (!token || !magnet) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const cleanToken = token.trim();
  // TorBox tokens are UUID format (e.g. 8-4-4-4-12 hex format)
  const isTorBox = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken);

  if (isTorBox) {
    try {
      // 1. Add magnet to TorBox
      const addRes = await fetch('https://api.torbox.app/v1/api/torrents/createtorrent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `magnet=${encodeURIComponent(magnet)}&seed=1&allow_zip=false`
      });
      const addData = await addRes.json();
      const torrentId = addData?.data?.torrent_id;

      if (!torrentId) {
        return res.status(400).json({ error: addData?.detail || 'Error añadiendo magnet a TorBox' });
      }

      // 2. Query file list
      const listRes = await fetch(`https://api.torbox.app/v1/api/torrents/mylist?id=${torrentId}&bypass_cache=true`, {
        headers: { 'Authorization': `Bearer ${cleanToken}` }
      });
      const listData = await listRes.json();
      const torrentInfo = Array.isArray(listData?.data) ? listData.data[0] : listData?.data;
      const files = torrentInfo?.files || [];

      if (!files.length) {
        return res.status(400).json({ error: 'TorBox está procesando el archivo en caché...' });
      }

      // Pick the largest file (the main video)
      const sortedFiles = [...files].sort((a, b) => (b.size || 0) - (a.size || 0));
      const targetFile = sortedFiles[0];

      // 3. Request direct download link
      const dlRes = await fetch(`https://api.torbox.app/v1/api/torrents/requestdl?token=${encodeURIComponent(cleanToken)}&torrent_id=${torrentId}&file_id=${targetFile.id}`);
      const dlData = await dlRes.json();

      if (dlData?.data) {
        return res.status(200).json({ streamUrl: dlData.data });
      }

      // Fallback permalink redirect
      const directUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${encodeURIComponent(cleanToken)}&torrent_id=${torrentId}&file_id=${targetFile.id}&redirect=true`;
      return res.status(200).json({ streamUrl: directUrl });
    } catch (err) {
      return res.status(500).json({ error: `TorBox error: ${err.message}` });
    }
  }

  // Otherwise, handle Real-Debrid
  try {
    // 1. Add magnet to Real-Debrid
    const addRes = await fetch('https://api.real-debrid.com/rest/1.0/torrents/addMagnet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `magnet=${encodeURIComponent(magnet)}`
    });
    const addData = await addRes.json();
    if (!addData.id) {
      return res.status(400).json({ error: 'Error añadiendo magnet a Real-Debrid' });
    }

    // 2. Select all files
    await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${addData.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'files=all'
    });

    // 3. Get Torrent Info for links
    const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${addData.id}`, {
      headers: { 'Authorization': `Bearer ${cleanToken}` }
    });
    const infoData = await infoRes.json();
    const links = infoData.links || [];

    if (!links.length) {
      return res.status(400).json({ error: 'El archivo aún se está almacenando en el caché de Debrid' });
    }

    // 4. Unrestrict first video link
    const unrestrictRes = await fetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `link=${encodeURIComponent(links[0])}`
    });
    const unrestrictData = await unrestrictRes.json();

    if (unrestrictData.download) {
      return res.status(200).json({ streamUrl: unrestrictData.download });
    }

    return res.status(400).json({ error: 'No se pudo generar enlace directo' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
