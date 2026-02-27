import { fetchTrafficSignals } from "./api.js";

export function initMapController({
    mapId = "map",
    center = [42.3601, -71.0589],
    zoom = 13,
} = {}) {
    const map = L.map(mapId).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    const leftLayer = L.layerGroup().addTo(map);

    let startMarker = null;
    let endMarker = null;
    let routeLayer = null;

    function resetRoute() {
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
    }

    function setMarkers(startPlace, endPlace) {
        startMarker = L.marker([startPlace.lat, startPlace.lon])
            .addTo(map)
            .bindPopup("Start<br>" + startPlace.displayName);

        endMarker = L.marker([endPlace.lat, endPlace.lon])
            .addTo(map)
            .bindPopup("End<br>" + endPlace.displayName);
    }

    function drawRoute(route) {
        routeLayer = L.geoJSON(route.geometry).addTo(map);
        map.fitBounds(routeLayer.getBounds());
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

        const h =
            sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

        return 2 * R * Math.asin(Math.sqrt(h));
    }

    // Find unprotected left turns and mark them on the map
    async function highlightUnprotectedLefts(route) {
        const steps = route.legs.flatMap((l) => l.steps);

        const leftTurns = [];
        const unprotectedIdxSet = new Set();

        let south = 90,
            north = -90,
            west = 180,
            east = -180;

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
                name: step.name || "road",
            });

            south = Math.min(south, lat);
            north = Math.max(north, lat);
            west = Math.min(west, lon);
            east = Math.max(east, lon);
        });

        if (!leftTurns.length) {
            return unprotectedIdxSet;
        }

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
                color: "red",
            }).bindPopup(`Unprotected left onto ${name}`);

            leftLayer.addLayer(marker);
        }

        return unprotectedIdxSet;
    }

    return {
        map,
        resetRoute,
        setMarkers,
        drawRoute,
        highlightUnprotectedLefts,
    };
}