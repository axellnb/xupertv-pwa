// Vercel Serverless Function: Debrid Stream Resolver
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { token, magnet } = req.query;
  if (!token || !magnet) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    // 1. Add magnet to Real-Debrid
    const addRes = await fetch('https://api.real-debrid.com/rest/1.0/torrents/addMagnet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `magnet=${encodeURIComponent(magnet)}`
    });
    const addData = await addRes.json();
    if (!addData.id) {
      return res.status(400).json({ error: 'Error añadiendo magnet a Debrid' });
    }

    // 2. Select all files
    await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${addData.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'files=all'
    });

    // 3. Get Torrent Info for links
    const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${addData.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
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
        'Authorization': `Bearer ${token}`,
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
