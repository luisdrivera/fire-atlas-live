# FIRE ATLAS (Caribbean monitor)

**Harmonized MODIS + VIIRS fire detections for the Caribbean, with a live NASA FIRMS monitor.**
NASA Space Apps Challenge 2026 · Challenge: *Harmonization of MODIS and VIIRS Hot Spots*

- **Live demo:** https://fire-atlas-live.vercel.app/
- **Companion validation study** (La Española and Mato Grosso, held-out 2023-2024 test): https://fire-atlas-nu.vercel.app/

## What it does

MODIS (1 km) and VIIRS (375 m) detect fires with different sensitivity, so raw counts from the two sensors cannot be read as one continuous history. FIRE ATLAS puts both on one comparable scale for eight Caribbean territories, from November 2000 to November 2026, and shows what changes before and after harmonization.

Main views:

- **Harmonization simulator:** raw MODIS and VIIRS counts versus the harmonized series, with a cross-plot of monthly MODIS against harmonized counts.
- **Burning calendar:** month-by-year heatmap with anomaly against the monthly historical median, plus a seasonal corridor (P25-P90) and a selectable comparison year.
- **Historical recurrence map:** accumulated detections per grid cell (2,516 cells) with peak month and maximum FRP, filterable by territory or by a polygon or rectangle drawn on the map.
- **Live monitor:** near-real-time NASA FIRMS detections fused across sensors and compared with the historical distribution for the same month. This is a comparison with past data, not a forecast.
- **CSV export** of the harmonized monthly calendar.

## Data

- NASA FIRMS active-fire detections (MODIS and VIIRS). Low-confidence detections are excluded.
- Period: 2000-11-01 to 2026-11-14.
- 2,145 territory-month rows and 2,516 spatial cells, precomputed offline into `caribe_data.js`. The processing script is not included in this repository.
- Totals in the file: 219,434 raw MODIS detections, 545,178 raw VIIRS detections, 848,182 harmonized events.
- Basemaps: Esri World Imagery, Physical and Dark Gray tiles. Fire data: NASA FIRMS.

## Method

- **Before 2012:** monthly MODIS counts are multiplied by a per-territory calibration factor.
- **From 2012:** MODIS and VIIRS detections are fused and de-duplicated.
- **Live mode:** queries FIRMS near-real-time data and fuses sensors by de-duplicating detections at roughly 1 km and one day. This is de-duplication, not calibration. Live detections are kept only within about 0.2 degrees of cells where the historical record has detections for the selected territory, so live and historical counts cover the same area.

Per-territory factors: Cuba 3.43, Dominican Republic 5.37, Haiti 6.96, Jamaica 5.47, Bahamas and Turks and Caicos 3.75, Lesser Antilles 2.30, Puerto Rico and Virgin Islands 6.43, Southern Caribbean (ABC) 12.05.

## Limitations

- The series changes definition in 2012 (scaled MODIS before, fused MODIS + VIIRS after), so long-term trends across that year should be read with caution.
- The reported correlation (r = 0.9923) is computed on monthly totals during the overlap period. Seasonality inflates monthly correlations, and it is not an out-of-sample test.
- One factor per territory is used. It does not separate day from night and has not been tested on held-out data.
- Counts are satellite detections, not individual fires.
- Alert levels compare the current rate with the historical distribution for the same month. They are not forecasts.
- The recommendations panel is general awareness guidance, not derived from this project's data and not validated.
- "Simulate Alert" generates synthetic data for demonstration only.
- Fires in places with no historical detections are not shown in live mode.

The companion study addresses the validation gap with a held-out test (trained 2018-2022, tested 2023-2024) for La Española and Mato Grosso.

## Architecture

Static page (`index.html`, `app.js`, `caribe_data.js`) plus one serverless function:

- `api/firms.js` proxies requests to NASA FIRMS. The MAP_KEY lives only in the `FIRMS_MAP_KEY` environment variable on the server and never reaches the browser. The function accepts only four known sensor names, a valid bounding box and 1-5 days, and caches responses for five minutes.
- Libraries loaded from CDNs: Leaflet, Leaflet.draw, Apache ECharts, Tailwind CSS.

## Run and deploy

Static views (without live data) open directly from `index.html`. Live mode needs the serverless function, so deploy to Vercel:

```bash
npx vercel
npx vercel env add FIRMS_MAP_KEY   # your NASA FIRMS MAP_KEY, Production
npx vercel --prod
```

Get a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/area/

## Credits

Fire detections: NASA FIRMS (MODIS and VIIRS). Basemap tiles: Esri. Built for NASA Space Apps Challenge 2026.
