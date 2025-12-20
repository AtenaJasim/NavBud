// Initialize map
const map = L.map('map').setView([42.3601, -71.0589], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Starting and ending markers and layers
let startMarker = null;
let endMarker = null;
let routeLayer = null;
const leftLayer = L.layerGroup().addTo(map);

const statusEl = document.getElementById('status');

const routePanel = document.getElementById('routePanel');
const routeStepsEl = document.getElementById('routeSteps');
const routeTimeEl = document.getElementById('routeTime');

function openRouteUI() {
  document.body.classList.add('show-route');
  if (routePanel) routePanel.classList.add('visible');

  // Leaflet needs this after the map container width changes
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minsTotal = Math.round(seconds / 60);
  const hrs = Math.floor(minsTotal / 60);
  const mins = minsTotal % 60;

  if (hrs <= 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatStepText(step) {
  const name = (step && step.name) ? step.name : 'road';
  const m = step.maneuver || {};
  const type = String(m.type || '');
  const mod = String(m.modifier || '');

  if (type === 'depart') return `Start on ${name}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'turn') return `Turn ${mod || ''} onto ${name}`.replace(/\s+/g, ' ').trim();
  if (type === 'continue') return `Continue on ${name}`;
  if (type === 'merge') return `Merge ${mod || ''} onto ${name}`.replace(/\s+/g, ' ').trim();
  if (type === 'roundabout') return `Enter roundabout toward ${name}`;
  if (type === 'fork') return `Keep ${mod || ''} to stay on ${name}`.replace(/\s+/g, ' ').trim();
  if (type === 'new name') return `Continue onto ${name}`;
  if (type === 'end of road') return `At the end of the road, turn ${mod || ''} onto ${name}`.replace(/\s+/g, ' ').trim();


  return `${type} ${mod} ${name}`.replace(/\s+/g, ' ').trim();
}

function renderRouteSteps(route, unprotectedIdxSet) {
  if (!routeStepsEl || !routeTimeEl) return;

  routeTimeEl.textContent = formatDuration(route.duration);

  routeStepsEl.innerHTML = '';
  const steps = route.legs.flatMap((l) => l.steps);

  steps.forEach((step, idx) => {
    const li = document.createElement('li');

    if (unprotectedIdxSet && unprotectedIdxSet.has(idx)) {
      const street = step.name || 'road';

      const red = document.createElement('span');
      red.className = 'unprotected-left';
      red.textContent = 'Unprotected left';

      li.appendChild(red);
      li.appendChild(document.createTextNode(` onto ${street}`));
    } else {
      li.textContent = formatStepText(step);
    }

    routeStepsEl.appendChild(li);
  });
}


function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

// Use Geocode to convert text addresses into {lat, lon, displayName}
async function geocode(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: query,
      format: 'json',
      limit: 1,
      addressdetails: 1
    });

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  const data = await res.json();
  if (!data.length) {
    throw new Error('No results for: ' + query);
  }

  const item = data[0];
  return {
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name
  };
}

// Use OSRM to compute the route
async function getRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?steps=true&geometries=geojson&overview=full`;

  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes || !data.routes.length) {
    throw new Error('No route returned from OSRM');
  }
  return data.routes[0];
}

// Distance between two points in meters
// Used to compute distance of a left turn from a nearby traffic light
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * R * Math.asin(Math.sqrt(h));
}

// Get traffic light data from Overpass in a bbox
async function fetchTrafficSignals(bbox) {
  const [south, west, north, east] = bbox;

  const query = `
    [out:json][timeout:25];
    (
      node["highway"="traffic_signals"](${south},${west},${north},${east});
      node["crossing"="traffic_signals"](${south},${west},${north},${east});
    );
    out body;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query
  });

  const data = await res.json();
  if (!data.elements) return [];

  return data.elements.map((el) => ({
    lat: el.lat,
    lon: el.lon
  }));
}

// Find unprotected left turns
async function highlightUnprotectedLefts(route) {
  const steps = route.legs.flatMap((l) => l.steps);

  const leftTurns = [];
  const unprotectedIdxSet = new Set();

  let south = 90, north = -90, west = 180, east = -180;

  steps.forEach((step, idx) => {
    const maneuver = step.maneuver || {};
    const type = maneuver.type;
    const modifier = String(maneuver.modifier || '');

    const isLeftTurn = type === 'turn' && modifier.includes('left');
    if (!isLeftTurn) return;

    const inter = step.intersections && step.intersections[0];
    const loc = (inter && inter.location) || maneuver.location;
    if (!loc) return;

    const [lon, lat] = loc;
    const pt = { lat, lon };

    leftTurns.push({
      idx,
      point: pt,
      name: step.name || 'road'
    });

    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  });

  if (!leftTurns.length) {
    console.log('No left turns found on this route');
    return unprotectedIdxSet;
  }

  const pad = 0.001;
  const bbox = [south - pad, west - pad, north + pad, east + pad];

  let signals = [];
  try {
    signals = await fetchTrafficSignals(bbox);
  } catch (err) {
    console.error('Failed to get traffic signals from Overpass', err);
  }

  const SIGNAL_RADIUS_M = 30;

  for (const { idx, point, name } of leftTurns) {
    let protectedTurn = false;

    if (signals.length) {
      let minDist = Infinity;
      for (const sig of signals) {
        const d = distanceMeters(point, sig);
        if (d < minDist) minDist = d;
      }
      protectedTurn = minDist < SIGNAL_RADIUS_M;
    }

    if (protectedTurn) continue;

    unprotectedIdxSet.add(idx);

    const marker = L.circleMarker([point.lat, point.lon], {
      radius: 6,
      color: 'red'
    }).bindPopup(`Unprotected left onto ${name}`);

    leftLayer.addLayer(marker);
  }

  return unprotectedIdxSet;
}


async function buildRoute(startPlace, endPlace) {
  // Clear old route and markers
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
  leftLayer.clearLayers();

  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  if (endMarker) {
    map.removeLayer(endMarker);
    endMarker = null;
  }

  // Add new markers
  startMarker = L.marker([startPlace.lat, startPlace.lon])
    .addTo(map)
    .bindPopup('Start<br>' + startPlace.displayName);
  endMarker = L.marker([endPlace.lat, endPlace.lon])
    .addTo(map)
    .bindPopup('End<br>' + endPlace.displayName);

  setStatus('Getting route...');

  const route = await getRoute(startPlace, endPlace);

  routeLayer = L.geoJSON(route.geometry).addTo(map);
  map.fitBounds(routeLayer.getBounds());

  setStatus('Finding unprotected left turns...');
  const unprotectedIdxSet = await highlightUnprotectedLefts(route);

  // Show time + steps under the controls
  renderRouteSteps(route, unprotectedIdxSet);

  setStatus('Done!');

}

const historyButton = document.getElementById('historyButton');
const historySidebar = document.getElementById('historySidebar');
const sidebarClose = document.getElementById('sidebarClose');
const historyList = document.getElementById('historyList');

const routeHistory = [];
const MAX_HISTORY_ITEMS = 10;

function openHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.add('open');
  }
}

function closeHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.remove('open');
  }
}

function renderHistory() {
  if (!historyList) return;

  historyList.innerHTML = '';

  routeHistory.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.startText} → ${item.endText}`;
    li.title = `${item.startPlace.displayName} → ${item.endPlace.displayName}`;

    li.addEventListener('click', async () => {
      closeHistorySidebar();

      startInput.value = item.startText;
      endInput.value = item.endText;

      openRouteUI();

      setStatus('');
      try {
        setStatus('Loading route from history...');
        await buildRoute(item.startPlace, item.endPlace);
      } catch (err) {
        console.error(err);
        alert(err.message || 'There was a problem loading this route.');
        setStatus('');
      }
    });

    historyList.appendChild(li);
  });
}


function addRouteToHistory(startText, endText, startPlace, endPlace) {
  const key = `${startText}||${endText}`;

  // If route already exists, move it to the top
  const existingIndex = routeHistory.findIndex((item) => item.key === key);
  if (existingIndex !== -1) {
    const [existing] = routeHistory.splice(existingIndex, 1);
    routeHistory.unshift(existing);
  } else {
    routeHistory.unshift({
      key,
      startText,
      endText,
      startPlace,
      endPlace
    });
  }

  if (routeHistory.length > MAX_HISTORY_ITEMS) {
    routeHistory.length = MAX_HISTORY_ITEMS;
  }

  renderHistory();
}

// Open / Close button
if (historyButton) {
  historyButton.addEventListener('click', () => {
    openHistorySidebar();
  });
}

if (sidebarClose) {
  sidebarClose.addEventListener('click', () => {
    closeHistorySidebar();
  });
}

// Close button with escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeHistorySidebar();
  }
});


const routeForm = document.getElementById('routeForm');
const startInput = document.getElementById('startText');
const endInput = document.getElementById('endText');

if (routeForm && endInput) {
  endInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      routeForm.requestSubmit();
    }
  });
}

if (routeForm) {
  routeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const startText = startInput.value.trim();
    const endText = endInput.value.trim();

    if (!startText || !endText) {
      alert('Please enter both start and end.');
      return;
    }

    // Expand left side as soon as Enter triggers submit
    openRouteUI();

    try {
      setStatus('Finding locations...');

      const [startPlace, endPlace] = await Promise.all([
        geocode(startText),
        geocode(endText)
      ]);

      await buildRoute(startPlace, endPlace);
      addRouteToHistory(startText, endText, startPlace, endPlace);
    } catch (err) {
      console.error(err);
      alert(err.message || 'There was a problem finding the route.');
      setStatus('');
    }
  });
}