let harmChart = null;
let scatterChart = null;
let burnCalendarChart = null;
let seasonalClimChart = null;
let currentMode = 'comparison';
let selectedCalYear = 2026;
let activeRole = 'farmers';

let liveMap = null;
let liveMarkersLayer = null;
let histMarkersLayer = null;
let drawnItemsLayer = null;
let customPolygonCoords = null; // Array of [lat, lon]

let rawLiveHotspots = [];
let currentAlertLevel = 'NORMAL';
let currentLiveStats = {};
const HISTORICAL_CELL_KEYS_BY_REGION = {};

const MONTHS_ES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const REGION_LABELS = {
  'República Dominicana': 'Dominican Republic',
  'Haití': 'Haiti',
  'Cuba': 'Cuba',
  'Jamaica': 'Jamaica',
  'Bahamas y Turcas y Caicos': 'Bahamas and Turks and Caicos',
  'Antillas Menores': 'Lesser Antilles',
  'Puerto Rico e I. Vírgenes': 'Puerto Rico and U.S./British Virgin Islands',
  'Caribe Sur (ABC)': 'Southern Caribbean (ABC)'
};

const REGION_BOUNDS = {
  'ALL': { center: [19.2, -72.5], zoom: 5, bbox: '-85.2,10.0,-59.4,27.3' },
  'República Dominicana': { center: [18.85, -70.15], zoom: 8, bbox: '-72.05,17.45,-68.30,19.95' },
  'Cuba': { center: [21.5, -79.5], zoom: 7, bbox: '-85.0,19.8,-74.1,23.3' },
  'Haití': { center: [19.0, -72.8], zoom: 8, bbox: '-74.5,18.0,-71.6,20.1' },
  'Jamaica': { center: [18.15, -77.3], zoom: 9, bbox: '-78.4,17.65,-76.15,18.55' },
  'Bahamas y Turcas y Caicos': { center: [23.8, -75.5], zoom: 6, bbox: '-79.4,20.9,-71.0,27.3' },
  'Antillas Menores': { center: [14.5, -61.0], zoom: 7, bbox: '-63.2,10.0,-59.4,18.3' },
  'Puerto Rico e I. Vírgenes': { center: [18.2, -66.2], zoom: 9, bbox: '-68.0,17.6,-64.2,18.6' },
  'Caribe Sur (ABC)': { center: [12.3, -69.1], zoom: 9, bbox: '-70.1,12.0,-68.1,12.7' }
};

function initFireAtlas() {
  const badge = document.getElementById('statusBadge');

  if (typeof window.CARIBE_DATA === 'undefined') {
    badge.textContent = '⚠ caribe_data.js is missing from the folder';
    badge.className = 'text-[11px] font-semibold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full';
    return;
  }

  badge.textContent = '✓ Historical Database: ' + window.CARIBE_DATA.metadata.total_harmonized_events.toLocaleString('en-US') + ' events';
  badge.className = 'text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full';

  // Init ECharts (Parte 1 y Parte 3)
  harmChart = echarts.init(document.getElementById('harmonizationChart'));
  scatterChart = echarts.init(document.getElementById('scatterChart'));
  burnCalendarChart = echarts.init(document.getElementById('burnCalendarChart'));
  seasonalClimChart = echarts.init(document.getElementById('seasonalClimatologyChart'));

  // Poblar selector de año de comparación del calendario
  const calYearSel = document.getElementById('calendarCompareYear');
  for (let y = 2026; y >= 2001; y--) {
    calYearSel.add(new Option(y, y, y === 2026, y === 2026));
  }
  calYearSel.addEventListener('change', (e) => {
    selectedCalYear = parseInt(e.target.value);
    renderBurningCalendar();
  });
  document.getElementById('calendarPalette').addEventListener('change', renderBurningCalendar);
  document.getElementById('btnExportCalendarCSV').addEventListener('click', exportCalendarCSV);

  // Init Leaflet Map (Parte 2)
  initLiveMap();

  // Event Listeners
  document.getElementById('regionSelect').addEventListener('change', () => {
    customPolygonCoords = null;
    document.getElementById('btnClearPoly').classList.add('hidden');
    document.getElementById('polyStatus').textContent = 'Area: Entire territory';
    if (drawnItemsLayer) drawnItemsLayer.clearLayers();
    renderHistoricalLayer();
    renderBurningCalendar();
    renderPart1();
    fetchLiveHotspots();
  });

  document.getElementById('btnRefreshLive').addEventListener('click', fetchLiveHotspots);
  document.getElementById('liveSensorSelect').addEventListener('change', fetchLiveHotspots);
  document.getElementById('liveDaysSelect').addEventListener('change', fetchLiveHotspots);
  document.getElementById('btnSimulateAlert').addEventListener('click', simulateCriticalScenario);

  document.getElementById('chkLiveLayer').addEventListener('change', (e) => {
    if (e.target.checked) liveMap.addLayer(liveMarkersLayer);
    else liveMap.removeLayer(liveMarkersLayer);
  });

  document.getElementById('chkHistLayer').addEventListener('change', (e) => {
    if (e.target.checked) liveMap.addLayer(histMarkersLayer);
    else liveMap.removeLayer(histMarkersLayer);
  });

  document.getElementById('btnClearPoly').addEventListener('click', () => {
    customPolygonCoords = null;
    if (drawnItemsLayer) drawnItemsLayer.clearLayers();
    document.getElementById('btnClearPoly').classList.add('hidden');
    document.getElementById('polyStatus').textContent = 'Area: Entire territory';
    renderHistoricalLayer();
    analyzeLiveAndForecast();
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-slate-300');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.classList.remove('text-slate-300');
      currentMode = e.currentTarget.getAttribute('data-mode');
      renderPart1();
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-slate-400');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.classList.remove('text-slate-400');
      activeRole = e.currentTarget.getAttribute('data-role');
      renderRecommendations();
    });
  });

  window.addEventListener('resize', () => {
    if (harmChart) harmChart.resize();
    if (scatterChart) scatterChart.resize();
    if (burnCalendarChart) burnCalendarChart.resize();
    if (seasonalClimChart) seasonalClimChart.resize();
    if (liveMap) liveMap.invalidateSize();
  });

  renderHistoricalLayer();
  renderBurningCalendar();
  renderPart1();
  fetchLiveHotspots();
}

// =========================================================================
// PARTE 2: MAPA GEOESPACIAL, POLÍGONOS LIBRES, ANÁLISIS EN VIVO Y ALERTA
// =========================================================================
function initLiveMap() {
  const initRegion = document.getElementById('regionSelect').value;
  const view = REGION_BOUNDS[initRegion] || REGION_BOUNDS['ALL'];

  liveMap = L.map('liveMap').setView(view.center, view.zoom);

  // Capa Satelital Física (Estilo NASA FIRMS) + Fronteras y Lugares
  const satelliteBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics | NASA FIRMS',
    maxZoom: 17
  });

  const boundariesOverlay = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 17,
    opacity: 0.85
  });

  const physicalHybrid = L.layerGroup([satelliteBase, boundariesOverlay]).addTo(liveMap);

  const topoPhysical = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; US National Park Service | NASA FIRMS',
    maxZoom: 8
  });

  const darkCanvas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | NASA FIRMS',
    maxZoom: 16
  });

  L.control.layers({
    '🛰️ Physical Satellite + Boundaries': physicalHybrid,
    '⛰️ Physical Terrain': topoPhysical,
    '🌑 Dark Map': darkCanvas
  }, null, { position: 'topright' }).addTo(liveMap);

  histMarkersLayer = L.layerGroup().addTo(liveMap);
  liveMarkersLayer = L.layerGroup().addTo(liveMap);
  drawnItemsLayer = new L.FeatureGroup().addTo(liveMap);

  // Herramienta Leaflet.draw para dibujar rectángulos o polígonos libres
  if (L.Control && L.Control.Draw) {
    const drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: false,
        marker: false,
        circlemarker: false,
        polygon: { shapeOptions: { color: '#38bdf8', weight: 2, fillOpacity: 0.12 } },
        rectangle: { shapeOptions: { color: '#38bdf8', weight: 2, fillOpacity: 0.12 } }
      },
      edit: {
        featureGroup: drawnItemsLayer,
        edit: false,
        remove: true
      }
    });
    liveMap.addControl(drawControl);

    liveMap.on(L.Draw.Event.CREATED, function (event) {
      drawnItemsLayer.clearLayers();
      const layer = event.layer;
      drawnItemsLayer.addLayer(layer);
      const latlngs = layer.getLatLngs()[0];
      customPolygonCoords = latlngs.map(ll => [ll.lat, ll.lng]);
      document.getElementById('polyStatus').innerHTML = `<span class="text-sky-400 font-bold">Custom polygon (${customPolygonCoords.length} vertices)</span>`;
      document.getElementById('btnClearPoly').classList.remove('hidden');
      renderHistoricalLayer();
      analyzeLiveAndForecast();
    });

    liveMap.on(L.Draw.Event.DELETED, function () {
      customPolygonCoords = null;
      document.getElementById('btnClearPoly').classList.add('hidden');
      document.getElementById('polyStatus').textContent = 'Area: Entire territory';
      renderHistoricalLayer();
      analyzeLiveAndForecast();
    });
  }
}

// Algoritmo Ray-Casting para filtrar puntos dentro del polígono dibujado
function pointInPolygon(lat, lon, poly) {
  if (!poly || poly.length < 3) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lon) !== (yj > lon)) &&
      (lat < (xj - xi) * (lon - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function renderHistoricalLayer() {
  histMarkersLayer.clearLayers();
  const region = document.getElementById('regionSelect').value;

  const cells = window.CARIBE_DATA.spatial_cells.filter(c => {
    const regOk = (region === 'ALL' || c.region === region);
    if (!regOk) return false;
    if (customPolygonCoords) return pointInPolygon(c.lat_g, c.lon_g, customPolygonCoords);
    return true;
  });

  cells.forEach(c => {
    const radius = Math.min(11, Math.max(2.5, Math.log2(c.count + 1) * 1.15));
    L.circleMarker([c.lat_g, c.lon_g], {
      radius: radius,
      fillColor: '#0ea5e9',
      color: '#0284c7',
      weight: 0.4,
      opacity: 0.45,
      fillOpacity: 0.25
    }).bindPopup(`
      <div style="color:#0f172a; font-size:12px;">
        <strong>27-year history (${REGION_LABELS[c.region] || c.region})</strong><br/>
        Coordinates: ${c.lat_g}°, ${c.lon_g}°<br/>
        Accumulated detections: <strong>${c.count.toLocaleString('en-US')}</strong><br/>
        Historical maximum FRP: <strong>${c.max_frp} MW</strong><br/>
        Historical peak month: <strong>${MONTHS_ES[c.peak_month - 1]}</strong>
      </div>
    `).addTo(histMarkersLayer);
  });

  if (!customPolygonCoords && REGION_BOUNDS[region]) {
    const v = REGION_BOUNDS[region];
    liveMap.setView(v.center, v.zoom);
  }
}

function getHistoricalCellKeys(region) {
  if (!HISTORICAL_CELL_KEYS_BY_REGION[region]) {
    HISTORICAL_CELL_KEYS_BY_REGION[region] = new Set(
      window.CARIBE_DATA.spatial_cells
        .filter(c => region === 'ALL' || c.region === region)
        .map(c => `${Math.round(c.lat_g * 10)}_${Math.round(c.lon_g * 10)}`)
    );
  }
  return HISTORICAL_CELL_KEYS_BY_REGION[region];
}

function isNearHistoricalCell(lat, lon, region) {
  const cellKeys = getHistoricalCellKeys(region);
  const gridLat = Math.round(lat * 10);
  const gridLon = Math.round(lon * 10);

  for (let di = -2; di <= 2; di++) {
    for (let dj = -2; dj <= 2; dj++) {
      if (cellKeys.has(`${gridLat + di}_${gridLon + dj}`)) return true;
    }
  }
  return false;
}

async function fetchLiveHotspots() {
  const sensor = document.getElementById('liveSensorSelect').value;
  const days = document.getElementById('liveDaysSelect').value;
  const region = document.getElementById('regionSelect').value;
  const bbox = (REGION_BOUNDS[region] || REGION_BOUNDS['ALL']).bbox;
  const tsEl = document.getElementById('liveTimestamp');

  tsEl.textContent = 'Querying NASA/NOAA satellites live...';

  const sensorsToFetch = sensor === 'FUSED_ALL'
    ? ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT']
    : [sensor];

  try {
    const results = await Promise.all(
      sensorsToFetch.map(async (s) => {
        // La MAP_KEY vive en el servidor (api/firms.js), nunca en el navegador.
        const url = `/api/firms?sensor=${encodeURIComponent(s)}&bbox=${encodeURIComponent(bbox)}&days=${encodeURIComponent(days)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        return parseFirmsCsv(text, s);
      })
    );

    rawLiveHotspots = results.flat();
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    tsEl.innerHTML = `<span class="text-emerald-400 font-semibold">● NASA FIRMS Live</span> (${nowStr})`;
    analyzeLiveAndForecast();
  } catch (err) {
    tsEl.innerHTML = `<span class="text-amber-400">⚠ Network error with NASA FIRMS. Use "Simulate Alert" for an offline demo.</span>`;
  }
}

function parseFirmsCsv(csvText, sensorLabel) {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1 || csvText.includes('Invalid')) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const frpIdx = headers.indexOf('frp');
  const confIdx = headers.indexOf('confidence');
  const dnIdx = headers.indexOf('daynight');
  const satIdx = headers.indexOf('satellite');

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    const frp = parseFloat(cols[frpIdx]) || 0;
    const conf = (cols[confIdx] || '').trim();
    if (isNaN(lat) || isNaN(lon)) continue;
    // Filter low confidence as in the historical pipeline
    if (conf === 'l' || (!isNaN(parseFloat(conf)) && parseFloat(conf) < 30)) continue;

    out.push({
      lat, lon, frp, conf,
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      daynight: (cols[dnIdx] || 'D').trim(),
      satellite: cols[satIdx] || sensorLabel,
      sensor: sensorLabel
    });
  }
  return out;
}

// Simulador de escenario crítico para pruebas o presentaciones sin internet
function simulateCriticalScenario() {
  const region = document.getElementById('regionSelect').value;
  const center = (REGION_BOUNDS[region] || REGION_BOUNDS['República Dominicana']).center;
  const today = new Date().toISOString().slice(0, 10);

  const synthetic = [];
  // Generar 3 clústeres intensos + focos dispersos alrededor del territorio seleccionado
  const clusters = [
    [center[0] + 0.12, center[1] - 0.18, 85],
    [center[0] - 0.15, center[1] + 0.22, 65],
    [center[0] + 0.05, center[1] + 0.05, 45]
  ];
  clusters.forEach(([clat, clon, count]) => {
    for (let i = 0; i < count; i++) {
      synthetic.push({
        lat: clat + (Math.random() - 0.5) * 0.22,
        lon: clon + (Math.random() - 0.5) * 0.28,
        frp: +(8 + Math.random() * 95).toFixed(1),
        conf: 'h',
        date: today,
        time: Math.random() > 0.55 ? '0235' : '1415',
        daynight: Math.random() > 0.55 ? 'N' : 'D',
        satellite: Math.random() > 0.3 ? 'VIIRS S-NPP' : 'MODIS Aqua',
        sensor: 'SIMULATED_ALERT'
      });
    }
  });

  rawLiveHotspots = synthetic;
  document.getElementById('liveTimestamp').innerHTML = `<span class="text-rose-400 font-bold">● ALERT SIMULATION MODE ACTIVE</span>`;
  analyzeLiveAndForecast();
}

function analyzeLiveAndForecast() {
  liveMarkersLayer.clearLayers();
  const region = document.getElementById('regionSelect').value;
  const days = parseInt(document.getElementById('liveDaysSelect').value) || 2;

  // Filtrar focos activos por polígono si existe
  const filteredLive = rawLiveHotspots.filter(h => {
    if (customPolygonCoords && !pointInPolygon(h.lat, h.lon, customPolygonCoords)) return false;
    return h.sensor === 'SIMULATED_ALERT' || isNearHistoricalCell(h.lat, h.lon, region);
  });

  // Fusión en vivo a escala 1 km x 1 día (0.01 deg) para eliminar duplicados entre VIIRS y MODIS
  const fusedMap = new Map();
  filteredLive.forEach(h => {
    const key = `${h.date}_${h.lat.toFixed(2)}_${h.lon.toFixed(2)}`;
    if (!fusedMap.has(key)) {
      fusedMap.set(key, {
        lat: h.lat,
        lon: h.lon,
        maxFrp: h.frp,
        count: 1,
        date: h.date,
        daynight: h.daynight,
        sensors: new Set([h.satellite])
      });
    } else {
      const item = fusedMap.get(key);
      item.maxFrp = Math.max(item.maxFrp, h.frp);
      item.count += 1;
      if (h.daynight === 'N') item.daynight = 'N';
      item.sensors.add(h.satellite);
    }
  });

  const fusedEvents = Array.from(fusedMap.values());

  // Dibujar marcadores en el mapa
  fusedEvents.forEach(ev => {
    const color = ev.maxFrp > 50 ? '#ef4444' : (ev.maxFrp >= 15 ? '#f97316' : '#facc15');
    const radius = ev.maxFrp > 50 ? 8 : (ev.maxFrp >= 15 ? 6.5 : 5);
    const sensorList = Array.from(ev.sensors).join(' + ');

    L.circleMarker([ev.lat, ev.lon], {
      radius: radius,
      fillColor: color,
      color: '#ffffff',
      weight: 1,
      opacity: 0.95,
      fillOpacity: 0.9
    }).bindPopup(`
      <div style="color:#0f172a; font-size:12px;">
        <strong>🔥 Harmonized Active Front (1 km)</strong><br/>
        Date: <strong>${ev.date}</strong> (${ev.daynight === 'N' ? 'Nighttime 🌙' : 'Daytime ☀️'})<br/>
        Fire Radiative Power (FRP): <strong>${ev.maxFrp.toFixed(1)} MW</strong><br/>
        Fused detections: ${ev.count} (${sensorList})<br/>
        Coords: ${ev.lat.toFixed(4)}°, ${ev.lon.toFixed(4)}°
      </div>
    `).addTo(liveMarkersLayer);
  });

  document.getElementById('liveCountBadge').textContent = filteredLive.length.toLocaleString('en-US');

  // Estadísticas en tiempo real
  const totalFused = fusedEvents.length;
  const maxFrp = fusedEvents.reduce((m, e) => Math.max(m, e.maxFrp), 0);
  const meanFrp = totalFused > 0 ? fusedEvents.reduce((s, e) => s + e.maxFrp, 0) / totalFused : 0;
  const severeCount = fusedEvents.filter(e => e.maxFrp > 50).length;
  const nightCount = fusedEvents.filter(e => e.daynight === 'N').length;
  const nightPct = totalFused > 0 ? (nightCount / totalFused * 100) : 0;

  document.getElementById('statHarmLive').textContent = totalFused.toLocaleString('en-US');
  document.getElementById('statFrpLive').textContent = totalFused > 0 ? `${maxFrp.toFixed(0)} / ${meanFrp.toFixed(1)} MW` : '0 MW';
  document.getElementById('statNightPct').textContent = `${nightPct.toFixed(0)}%`;

  // Calcular percentiles históricos (P50, P75, P90) para el mes actual y el territorio seleccionado
  const currentMonth = new Date().getMonth() + 1; // 1..12
  const histRows = window.CARIBE_DATA.monthly_data.filter(d =>
    (region === 'ALL' || d.region === region) && d.month === currentMonth && d.year >= 2001 && d.year <= 2025
  );

  const byYearMonth = {};
  histRows.forEach(r => {
    byYearMonth[r.year] = (byYearMonth[r.year] || 0) + r.harmonized;
  });
  const histVals = Object.values(byYearMonth).sort((a, b) => a - b);

  const p50 = getPercentile(histVals, 0.50);
  const p75 = getPercentile(histVals, 0.75);
  const p90 = getPercentile(histVals, 0.90);

  // Proyección mensual estimada a partir del ritmo diario observado en vivo
  const dailyRate = totalFused / days;
  const projectedMonthly = Math.round(dailyRate * 30);

  // Determinar nivel de alerta
  const alertCard = document.getElementById('alertCard');
  const alertBadge = document.getElementById('alertBadge');
  const alertHeadline = document.getElementById('alertHeadline');
  const alertForecastText = document.getElementById('alertForecastText');

  if (totalFused === 0) {
    currentAlertLevel = 'NORMAL';
    alertCard.className = 'rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-2';
    alertBadge.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    alertBadge.textContent = '🟢 NORMAL REGIME';
    alertHeadline.textContent = 'No active hotspots detected in the last ' + (days * 24) + ' hours.';
    alertForecastText.textContent = `For ${MONTHS_ES[currentMonth - 1]}, the historical median (P50) is ${p50.toLocaleString('en-US')} events/month. Maintain preventive monitoring as the dry season approaches (January–April).`;
  } else if (projectedMonthly > p90 || severeCount >= 5) {
    currentAlertLevel = 'CRITICAL';
    alertCard.className = 'rounded-xl border border-rose-500/60 bg-rose-950/30 p-4 space-y-2';
    alertBadge.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40';
    alertBadge.textContent = '🔴 CRITICAL ANOMALY (> P90)';
    alertHeadline.textContent = `30-day extrapolation of the current rate: ${projectedMonthly.toLocaleString('en-US')} events/month exceeds the extreme threshold (${p90.toLocaleString('en-US')}).`;
    alertForecastText.textContent = 'Current pace is above the historical 90th percentile for this month. This is a comparison with past data, not a prediction.';
  } else if (projectedMonthly > p75 || severeCount >= 2) {
    currentAlertLevel = 'HIGH';
    alertCard.className = 'rounded-xl border border-orange-500/50 bg-orange-950/25 p-4 space-y-2';
    alertBadge.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40';
    alertBadge.textContent = '🟠 HIGH ALERT (P75–P90)';
    alertHeadline.textContent = `Accelerated activity: 30-day extrapolation of the current rate: ${projectedMonthly.toLocaleString('en-US')} events/month (Median: ${p50.toLocaleString('en-US')}).`;
    alertForecastText.textContent = 'Current pace is above the historical 75th percentile for this month. Historically, activity peaks between February and April.';
  } else {
    currentAlertLevel = 'WATCH';
    alertCard.className = 'rounded-xl border border-amber-400/40 bg-amber-950/20 p-4 space-y-2';
    alertBadge.className = 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
    alertBadge.textContent = '🟡 SEASONAL WATCH';
    alertHeadline.textContent = `${totalFused} active fronts detected (30-day extrapolation of the current rate: ${projectedMonthly.toLocaleString('en-US')} events/month).`;
    alertForecastText.textContent = `Activity within the expected range for ${MONTHS_ES[currentMonth - 1]} (P50 median: ${p50.toLocaleString('en-US')}). Monitor soil moisture and wind speed.`;
  }

  currentLiveStats = { totalFused, rawCount: filteredLive.length, severeCount, nightPct, dailyRate, projectedMonthly, p50, p90 };

  // Actualizar lista de análisis de patrones
  const insightsEl = document.getElementById('patternInsightsList');
  if (totalFused === 0) {
    insightsEl.innerHTML = `
      <li><strong>Clear satellite coverage:</strong> 0 vegetation detections in the selected area during the last ${days * 24}h.</li>
      <li><strong>Climate pattern:</strong> Historically, activity in the Caribbean picks up starting in January and reaches its peak in <strong>March</strong>.</li>
    `;
  } else {
    const ratioDeduplication = (filteredLive.length / totalFused).toFixed(1);
    const originPattern = nightPct > 35
      ? `<strong>High nighttime persistence (${nightPct.toFixed(0)}%):</strong> Suggests active wildfires during the early morning, not just daytime agricultural burning.`
      : `<strong>Daytime predominance (${(100 - nightPct).toFixed(0)}%):</strong> Pattern consistent with agricultural burning for land preparation or grasslands.`;
    const intensityPattern = severeCount > 0
      ? `<strong>High-energy cores:</strong> <strong>${severeCount} fronts with FRP &gt; 50 MW</strong> detected (maximum ${maxFrp.toFixed(1)} MW), with a high capacity to generate embers.`
      : `<strong>Moderate thermal intensity:</strong> All hotspots register FRP &lt; 50 MW (average ${meanFrp.toFixed(1)} MW), controllable with an early response.`;

    insightsEl.innerHTML = `
      <li><strong>Multi-sensor deduplication:</strong> ${filteredLive.length} satellite pixels consolidated into <strong>${totalFused} unique 1 km fronts</strong> (factor ${ratioDeduplication}×).</li>
      <li>${originPattern}</li>
      <li>${intensityPattern}</li>
    `;
  }

  renderRecommendations();
}

function renderRecommendations() {
  const box = document.getElementById('recommendationsBody');
  const lvl = currentAlertLevel;

  if (activeRole === 'farmers') {
    if (lvl === 'CRITICAL' || lvl === 'HIGH') {
      box.innerHTML = `
        <p class="font-bold text-rose-300">⛔ Temporary Suspension of Agricultural Burning</p>
        <p>• <strong>Avoid all stubble or land-clearing burns:</strong> The moisture deficit and current wind gusts increase the risk of escape into adjacent forests.</p>
        <p>• <strong>Immediate alternative:</strong> Incorporate chopped stubble into the soil to conserve moisture and avoid environmental penalties.</p>
        <p>• <strong>Farm protection:</strong> Clear and widen firebreaks along boundaries with dry vegetation.</p>
      `;
    } else {
      box.innerHTML = `
        <p class="font-bold text-emerald-300">✓ Safe Controlled Burning Protocol</p>
        <p>• <strong>Timing:</strong> Conduct agricultural burns when relative humidity is higher and wind is minimal.</p>
        <p>• <strong>Firebreaks:</strong> Clear strips of mineral soil around the plot before starting.</p>
        <p>• <strong>Continuous monitoring:</strong> Never leave the perimeter until the embers are completely extinguished with water or soil.</p>
      `;
    }
  } else if (activeRole === 'responders') {
    if (lvl === 'CRITICAL' || lvl === 'HIGH') {
      box.innerHTML = `
        <p class="font-bold text-amber-300">🚨 Preventive Deployment and Prioritization by FRP</p>
        <p>• <strong>Priority initial attack:</strong> Dispatch forest brigades to hotspots with <strong>FRP &gt; 50 MW</strong> and nighttime persistence shown in red on the map.</p>
        <p>• <strong>Cross-reference with history:</strong> Strengthen monitoring in blue cells with high historical recurrence near protected areas and watersheds.</p>
        <p>• <strong>Continuous monitoring:</strong> Update the VIIRS feed every 3 hours after the Suomi-NPP and NOAA-20 orbital passes.</p>
      `;
    } else {
      box.innerHTML = `
        <p class="font-bold text-sky-300">🛡️ Readiness and Preventive Monitoring</p>
        <p>• <strong>Maintenance of defensive lines:</strong> Check access routes and water supply points in areas that historically exceed the 75th percentile between January and April.</p>
        <p>• <strong>Field verification:</strong> Confirm recurring low-power hotspots (&lt;15 MW) with local park rangers to distinguish authorized agricultural burns.</p>
      `;
    }
  } else {
    if (lvl === 'CRITICAL' || lvl === 'HIGH') {
      box.innerHTML = `
        <p class="font-bold text-amber-300">😷 Smoke and Air Quality Alert (PM2.5)</p>
        <p>• <strong>Respiratory protection:</strong> If you live downwind of the active clusters on the map, keep doors and windows closed and avoid outdoor exercise.</p>
        <p>• <strong>Vulnerable groups:</strong> Children, older adults, and people with asthma should wear an N95 mask when smoke is present.</p>
        <p>• <strong>Early reporting:</strong> Notify 9-1-1 or forestry authorities of any column of smoke in wooded areas.</p>
      `;
    } else {
      box.innerHTML = `
        <p class="font-bold text-emerald-300">🌿 Community Prevention</p>
        <p>• <strong>No cigarette butts or campfires:</strong> Avoid throwing cigarette butts or glass bottles along roadsides and trails.</p>
        <p>• <strong>Waste management:</strong> Do not burn household waste or leaf litter near dry brush.</p>
      `;
    }
  }
}

function getPercentile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return Math.round(sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]));
  }
  return Math.round(sortedArr[base]);
}

// =========================================================================
// PARTE 1: SIMULADOR DE ARMONIZACIÓN HISTÓRICA (2000–2026)
// =========================================================================
function renderPart1() {
  const region = document.getElementById('regionSelect').value;
  const rows = window.CARIBE_DATA.monthly_data.filter(d => region === 'ALL' || d.region === region);

  const years = [];
  for (let y = 2000; y <= 2026; y++) years.push(y);

  const byYear = {};
  years.forEach(y => {
    byYear[y] = { modis: 0, viirs: 0, unharm: 0, harm: 0 };
  });

  let totalModis = 0, totalViirs = 0, totalHarm = 0;
  rows.forEach(r => {
    byYear[r.year].modis += r.modis_raw;
    byYear[r.year].viirs += r.viirs_raw;
    byYear[r.year].unharm += r.unharmonized_sum;
    byYear[r.year].harm += r.harmonized;
    totalModis += r.modis_raw;
    totalViirs += r.viirs_raw;
    totalHarm += r.harmonized;
  });

  let preSum = 0, postSum = 0;
  for (let y = 2001; y <= 2011; y++) preSum += byYear[y].unharm;
  for (let y = 2012; y <= 2025; y++) postSum += byYear[y].unharm;
  const preMean = preSum / 11;
  const postMean = postSum / 14;
  const rawJumpPct = preMean > 0 ? ((postMean / preMean - 1) * 100) : 0;

  document.getElementById('kpiModisRaw').textContent = totalModis.toLocaleString('en-US');
  document.getElementById('kpiViirsRaw').textContent = totalViirs.toLocaleString('en-US');
  document.getElementById('kpiRawJump').textContent = `+${rawJumpPct.toFixed(1)}%`;
  document.getElementById('kpiHarmonized').textContent = totalHarm.toLocaleString('en-US');

  const calFactor = region === 'ALL'
    ? 'Weighted Regional Scale (r = 0.9923)'
    : `${REGION_LABELS[region] || region} factor: ${(window.CARIBE_DATA.calibration_factors[region] || 1).toFixed(2)}× MODIS`;
  document.getElementById('kpiCalFactor').textContent = calFactor;

  const series = [];
  if (currentMode === 'unharmonized') {
    series.push(
      {
        name: 'Raw MODIS (1 km)',
        type: 'bar',
        stack: 'raw',
        data: years.map(y => byYear[y].modis),
        itemStyle: { color: '#38bdf8' }
      },
      {
        name: 'Raw VIIRS S-NPP (375 m)',
        type: 'bar',
        stack: 'raw',
        data: years.map(y => byYear[y].viirs),
        itemStyle: { color: '#f59e0b' }
      }
    );
  } else if (currentMode === 'harmonized') {
    series.push({
      name: 'Harmonized Series (1 km × 1 day)',
      type: 'bar',
      data: years.map(y => ({
        value: byYear[y].harm,
        itemStyle: { color: y < 2012 ? '#818cf8' : '#10b981' }
      }))
    });
  } else {
    series.push(
      {
        name: 'Unharmonized Raw Sum',
        type: 'bar',
        data: years.map(y => byYear[y].unharm),
        itemStyle: { color: 'rgba(244, 63, 94, 0.45)', borderColor: '#f43f5e', borderWidth: 1 }
      },
      {
        name: 'Harmonized Series (MODIS + VIIRS)',
        type: 'line',
        smooth: 0.25,
        symbolSize: 7,
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        data: years.map(y => byYear[y].harm)
      }
    );
  }

  harmChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
      axisPointer: { type: 'shadow' }
    },
    legend: { top: 0, textStyle: { color: '#cbd5e1' } },
    grid: { left: '4%', right: '3%', bottom: '14%', top: '14%', containLabel: true },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 18, bottom: 4, textStyle: { color: '#94a3b8' } }
    ],
    xAxis: { type: 'category', data: years, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: series
  }, true);

  const monthlyOverlap = {};
  rows.filter(r => r.year >= 2012).forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    if (!monthlyOverlap[key]) monthlyOverlap[key] = { m: 0, h: 0, label: key };
    monthlyOverlap[key].m += r.modis_raw;
    monthlyOverlap[key].h += r.harmonized;
  });

  const scatterPts = Object.values(monthlyOverlap).map(pt => [pt.m, pt.h, pt.label]);

  scatterChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
      formatter: (p) => `<strong>Month: ${p.data[2]}</strong><br/>Raw MODIS: ${p.data[0].toLocaleString('en-US')}<br/>Harmonized: ${p.data[1].toLocaleString('en-US')}`
    },
    grid: { left: '6%', right: '6%', bottom: '14%', top: '8%', containLabel: true },
    xAxis: {
      name: 'Monthly MODIS',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    yAxis: {
      name: 'Harmonized',
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    series: [{
      type: 'scatter',
      symbolSize: 7,
      itemStyle: { color: '#f59e0b', opacity: 0.85 },
      data: scatterPts
    }]
  }, true);
}

window.addEventListener('load', initFireAtlas);


// =========================================================================
// PARTE 3: CALENDARIO DE ACTIVIDAD DE QUEMAS Y CORREDOR PREDICTIVO
// =========================================================================
const CALENDAR_PALETTES = {
  ylorrd: ['#1e293b', '#fef08a', '#fdba74', '#f97316', '#dc2626', '#7f1d1d'],
  viridis: ['#1e293b', '#440154', '#31688e', '#35b779', '#fde725'],
  magma: ['#1e293b', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']
};

function renderBurningCalendar() {
  if (!burnCalendarChart || !seasonalClimChart) return;
  const region = document.getElementById('regionSelect').value;
  const paletteKey = document.getElementById('calendarPalette').value;
  const colors = CALENDAR_PALETTES[paletteKey] || CALENDAR_PALETTES.ylorrd;

  const rows = window.CARIBE_DATA.monthly_data.filter(d => region === 'ALL' || d.region === region);

  const years = [];
  for (let y = 2000; y <= 2026; y++) years.push(y);
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Construir matriz [year][monthIdx]
  const matrix = {};
  years.forEach(y => { matrix[y] = Array(12).fill(0); });
  rows.forEach(r => {
    matrix[r.year][r.month - 1] += r.harmonized;
  });

  // Calcular percentiles climatológicos por mes (2001–2025)
  const p25Arr = [], p50Arr = [], p75Arr = [], p90Arr = [];
  for (let m = 0; m < 12; m++) {
    const vals = [];
    for (let y = 2001; y <= 2025; y++) vals.push(matrix[y][m]);
    vals.sort((a, b) => a - b);
    p25Arr.push(getPercentile(vals, 0.25));
    p50Arr.push(getPercentile(vals, 0.50));
    p75Arr.push(getPercentile(vals, 0.75));
    p90Arr.push(getPercentile(vals, 0.90));
  }

  // Preparar datos para ECharts Heatmap: [monthIdx, yearIdx, value, anomalyPct]
  const heatmapData = [];
  let maxVal = 0;
  years.forEach((y, yIdx) => {
    for (let m = 0; m < 12; m++) {
      const val = matrix[y][m];
      if (val > maxVal) maxVal = val;
      const med = p50Arr[m];
      const anom = med > 0 ? Math.round(((val - med) / med) * 100) : 0;
      heatmapData.push([m, yIdx, val, anom]);
    }
  });

  burnCalendarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (p) => {
        const mIdx = p.data[0];
        const y = years[p.data[1]];
        const val = p.data[2];
        const anom = p.data[3];
        const sign = anom >= 0 ? '+' : '';
        const anomColor = anom > 25 ? '#f87171' : (anom < -20 ? '#34d399' : '#fbbf24');
        const era = y < 2012 ? 'Calibrated MODIS' : 'Fused MODIS + VIIRS';
        return `<strong>${MONTHS_ES[mIdx]} ${y}</strong> (${era})<br/>
                Harmonized events: <strong>${val.toLocaleString('en-US')}</strong><br/>
                Historical median (${monthsShort[mIdx]}): ${p50Arr[mIdx].toLocaleString('en-US')}<br/>
                Seasonal anomaly: <strong style="color:${anomColor}">${sign}${anom}%</strong>`;
      }
    },
    grid: { left: '8%', right: '3%', top: '4%', bottom: '13%' },
    xAxis: {
      type: 'category',
      data: monthsShort,
      splitArea: { show: true, areaStyle: { color: ['rgba(15,23,42,0.3)', 'rgba(30,41,59,0.3)'] } },
      axisLabel: { color: '#cbd5e1', fontWeight: 'bold' }
    },
    yAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: '#94a3b8', fontSize: 10 }
    },
    visualMap: {
      min: 0,
      max: Math.max(10, maxVal),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      itemWidth: 14,
      itemHeight: 160,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      inRange: { color: colors }
    },
    series: [{
      name: 'Burning Activity',
      type: 'heatmap',
      data: heatmapData,
      label: {
        show: true,
        fontSize: 9,
        color: '#f8fafc',
        formatter: (p) => p.data[2] >= 1000 ? (p.data[2] / 1000).toFixed(1) + 'k' : (p.data[2] > 0 ? p.data[2] : '')
      },
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(255, 255, 255, 0.6)', borderColor: '#38bdf8', borderWidth: 1.5 }
      }
    }]
  }, true);

  // Permitir clic en cualquier fila del calendario para actualizar la curva de comparación
  burnCalendarChart.off('click');
  burnCalendarChart.on('click', (params) => {
    const clickedYear = years[params.data[1]];
    if (clickedYear >= 2001) {
      selectedCalYear = clickedYear;
      document.getElementById('calendarCompareYear').value = clickedYear;
      renderBurningCalendar();
    }
  });

  // Renderizar Curva Climatológica Predictiva (Banda P25-P90 vs Año Seleccionado)
  document.getElementById('selectedYearLabel').textContent = selectedCalYear;
  const selectedYearData = matrix[selectedCalYear].map((v, idx) => (selectedCalYear === 2026 && idx > 10) ? null : v);

  // Calcular diferencia de banda (P90 - P25) para sombreado de riesgo
  const bandSpread = p90Arr.map((v, i) => Math.max(0, v - p25Arr[i]));

  seasonalClimChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 }
    },
    legend: { top: 0, textStyle: { color: '#cbd5e1', fontSize: 11 } },
    grid: { left: '5%', right: '4%', top: '16%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: monthsShort, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      {
        name: 'Base P25',
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        data: p25Arr,
        silent: true
      },
      {
        name: 'Historical Corridor (P25–P90)',
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(56, 189, 248, 0.18)' },
        data: bandSpread,
        silent: true
      },
      {
        name: 'Historical Median (P50)',
        type: 'line',
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { color: '#38bdf8', width: 2, type: 'dashed' },
        data: p50Arr
      },
      {
        name: `Year ${selectedCalYear}`,
        type: 'line',
        smooth: 0.25,
        symbolSize: 7,
        lineStyle: { color: '#f59e0b', width: 3 },
        itemStyle: { color: '#f59e0b' },
        data: selectedYearData
      }
    ]
  }, true);

  // Generar diagnóstico predictivo del ciclo anual para el territorio seleccionado
  let peakIdx = 0, lowIdx = 0;
  p50Arr.forEach((v, i) => {
    if (v > p50Arr[peakIdx]) peakIdx = i;
    if (v < p50Arr[lowIdx]) lowIdx = i;
  });
  const totalMedianYear = p50Arr.reduce((a, b) => a + b, 0);
  const drySeasonShare = totalMedianYear > 0
    ? ((p50Arr[0] + p50Arr[1] + p50Arr[2] + p50Arr[3]) / totalMedianYear * 100).toFixed(0)
    : 0;

  const regTitle = region === 'ALL' ? 'Whole Caribbean' : (REGION_LABELS[region] || region);
  document.getElementById('seasonalSummaryText').innerHTML =
    `In <strong>${regTitle}</strong>, <strong>${drySeasonShare}%</strong> of annual activity is concentrated between <strong>January and April</strong>, reaching its peak in <strong>${MONTHS_ES[peakIdx]}</strong> (Median: ${p50Arr[peakIdx].toLocaleString('en-US')} | Extreme P90 threshold: ${p90Arr[peakIdx].toLocaleString('en-US')}) and its minimum in <strong>${MONTHS_ES[lowIdx]}</strong> (${p50Arr[lowIdx].toLocaleString('en-US')}).`;
}

function exportCalendarCSV() {
  const region = document.getElementById('regionSelect').value;
  const rows = window.CARIBE_DATA.monthly_data.filter(d => region === 'ALL' || d.region === region);

  let csv = 'year,month,region,modis_raw,viirs_raw,unharmonized_sum,harmonized_events,mean_frp_mw,max_frp_mw\n';
  rows.forEach(r => {
    csv += `${r.year},${r.month},"${REGION_LABELS[r.region] || r.region}",${r.modis_raw},${r.viirs_raw},${r.unharmonized_sum},${r.harmonized},${r.mean_frp},${r.max_frp}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FireAtlas_Harmonized_Calendar_${(REGION_LABELS[region] || 'Whole Caribbean').replace(/\s+/g, '_')}_2000_2026.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
