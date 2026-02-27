export async function geocode(query) {
    const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
            q: query,
            format: "json",
            limit: 1,
            addressdetails: 1
        });

    const res = await fetch(url, {
        headers: { Accept: "application/json" }
    });

    const data = await res.json();
    if (!data.length) throw new Error("No results for: " + query);

    const item = data[0];
    return {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        displayName: item.display_name
    };
}

// OSRM
export async function getRoute(from, to) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.lon},${from.lat};${to.lon},${to.lat}` +
        `?steps=true&geometries=geojson&overview=full`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) {
        throw new Error("No route returned from OSRM");
    }
    return data.routes[0];
}

export function distanceMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);

    const h =
        sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

    return 2 * R * Math.asin(Math.sqrt(h));
}

// Overpass
export async function fetchTrafficSignals(bbox) {
    const [south, west, north, east] = bbox;

    const query = `
      [out:json][timeout:25];
      (
        node["highway"="traffic_signals"](${south},${west},${north},${east});
        node["crossing"="traffic_signals"](${south},${west},${north},${east});
      );
      out body;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
    });

    const data = await res.json();
    if (!data.elements) return [];

    return data.elements.map((el) => ({
        lat: el.lat,
        lon: el.lon
    }));
}

// Find unprotected lefts and mark them on the map
export async function highlightUnprotectedLefts(route, leftLayer) {
    const L = window.L;
    const steps = route.legs.flatMap((l) => l.steps);

    const leftTurns = [];
    const unprotectedIdxSet = new Set();

    let south = 90, north = -90, west = 180, east = -180;

    steps.forEach((step, idx) => {
        const maneuver = step.maneuver || {};
        const type = maneuver.type;
        const modifier = String(maneuver.modifier || "");

        const isLeftTurn = type === "turn" && modifier.includes("left");
        if (!isLeftTurn) return;

        const inter = step.intersections && step.intersections[0];
        const loc = (inter && inter.location) || maneuver.location;
        if (!loc) return;

        const [lon, lat] = loc;
        const pt = { lat, lon };

        leftTurns.push({
            idx,
            point: pt,
            name: step.name || "road"
        });

        south = Math.min(south, lat);
        north = Math.max(north, lat);
        west = Math.min(west, lon);
        east = Math.max(east, lon);
    });

    if (!leftTurns.length) return unprotectedIdxSet;

    const pad = 0.001;
    const bbox = [south - pad, west - pad, north + pad, east + pad];

    let signals = [];
    try {
        signals = await fetchTrafficSignals(bbox);
    } catch (err) {
        console.error("Failed to get traffic signals from Overpass", err);
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
            color: "red"
        }).bindPopup(`Unprotected left onto ${name}`);

        leftLayer.addLayer(marker);
    }

    return unprotectedIdxSet;
}