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

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

const TOKEN_STORAGE_KEY = "navbud_local_tokens";

function getIdTokenPayload() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;

    const tokens = JSON.parse(raw);
    const idToken = tokens?.id_token || tokens?.IdToken;
    if (!idToken) return null;

    const parts = idToken.split(".");
    if (parts.length < 2) return null;

    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payloadB64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getHistoryKeyForUser() {
  const payload = getIdTokenPayload();
  const userId = payload?.sub || payload?.email || payload?.["cognito:username"];
  if (!userId) return null;
  return "navbud_history_" + userId;
}

function loadUserHistoryInto(routeHistory, maxItems, renderHistory) {
  const key = getHistoryKeyForUser();
  if (!key) return;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;

    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return;

    routeHistory.length = 0;
    routeHistory.push(...items.slice(0, maxItems));
    renderHistory();
  } catch {
  }
}

function saveUserHistory(routeHistory) {
  const key = getHistoryKeyForUser();
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(routeHistory));
  } catch {
  }
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
  let south = 90,
    north = -90,
    west = 180,
    east = -180;

  for (const step of steps) {
    const maneuver = step.maneuver || {};
    const type = maneuver.type;
    const modifier = String(maneuver.modifier || '');

    const isLeftTurn = type === 'turn' && modifier.includes('left');
    if (!isLeftTurn) continue;
    const inter = step.intersections && step.intersections[0];
    const loc = (inter && inter.location) || maneuver.location;
    if (!loc) continue;

    const [lon, lat] = loc;
    const pt = { lat, lon };

    leftTurns.push({
      point: pt,
      name: step.name || 'road'
    });

    // Expand bbox around all left turns
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }

  if (!leftTurns.length) {
    console.log('No left turns found on this route');
    return;
  }

  const pad = 0.001;
  const bbox = [south - pad, west - pad, north + pad, east + pad];

  // Get traffic signal data from OSM
  let signals = [];
  try {
    signals = await fetchTrafficSignals(bbox);
  } catch (err) {
    console.error('Failed to get traffic signals from Overpass', err);
  }

  const SIGNAL_RADIUS_M = 30;

  for (const { point, name } of leftTurns) {
    let protectedTurn = false;

    if (signals.length) {
      let minDist = Infinity;
      for (const sig of signals) {
        const d = distanceMeters(point, sig);
        if (d < minDist) minDist = d;
      }
      protectedTurn = minDist < SIGNAL_RADIUS_M;
    }

    // Only show unprotected left turns
    if (protectedTurn) continue;

    const marker = L.circleMarker([point.lat, point.lon], {
      radius: 6,
      color: 'red'
    }).bindPopup(`Unprotected left onto ${name}`);

    leftLayer.addLayer(marker);
  }
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
  await highlightUnprotectedLefts(route);

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

      // Put the values back into the inputs
      startInput.value = item.startText;
      endInput.value = item.endText;

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
  saveUserHistory(routeHistory);
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

loadUserHistoryInto(routeHistory, MAX_HISTORY_ITEMS, renderHistory);

window.addEventListener("navbud:logout", () => {
  routeHistory.length = 0;
  renderHistory();
  closeHistorySidebar();
});
