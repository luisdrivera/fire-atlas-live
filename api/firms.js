// Serverless proxy for NASA FIRMS. The MAP_KEY lives only in the
// FIRMS_MAP_KEY environment variable on Vercel and never reaches the browser.
const ALLOWED_SOURCES = new Set([
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'MODIS_NRT'
]);
const BBOX_RE = /^-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?$/;

module.exports = async function handler(req, res) {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    res.status(500).setHeader('Content-Type', 'text/plain');
    return res.send('Server is missing FIRMS_MAP_KEY.');
  }

  const { sensor, bbox, days } = req.query || {};
  const d = parseInt(days, 10);

  if (!ALLOWED_SOURCES.has(sensor) || !BBOX_RE.test(String(bbox || '')) || !(d >= 1 && d <= 5)) {
    res.status(400).setHeader('Content-Type', 'text/plain');
    return res.send('Invalid parameters.');
  }

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${sensor}/${bbox}/${d}`;
  try {
    const upstream = await fetch(url);
    const text = await upstream.text();
    res.status(upstream.ok ? 200 : 502);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Cache 5 minutes at the edge to protect the FIRMS quota.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.send(text);
  } catch (err) {
    res.status(502).setHeader('Content-Type', 'text/plain');
    return res.send('Upstream request to NASA FIRMS failed.');
  }
};
