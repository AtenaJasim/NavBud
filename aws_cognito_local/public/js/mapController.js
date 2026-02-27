import { getRoute, highlightUnprotectedLefts } from "./api.js";

export function createMapController(mapId) {
    const L = window.L;

    const map = L.map(mapId).setView([42.3601, -71.0589], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    let startMarker = null;
    let endMarker = null;
    let routeLayer = null;

    const leftLayer = L.layerGroup().addTo(map);

    function clearRoute() {
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

    async function buildRoute(startPlace, endPlace, { setStatus, renderRouteSteps }) {
        clearRoute();

        startMarker = L.marker([startPlace.lat, startPlace.lon])
            .addTo(map)
            .bindPopup("Start<br>" + startPlace.displayName);

        endMarker = L.marker([endPlace.lat, endPlace.lon])
            .addTo(map)
            .bindPopup("End<br>" + endPlace.displayName);

        setStatus("Getting route...");

        const route = await getRoute(startPlace, endPlace);

        routeLayer = L.geoJSON(route.geometry).addTo(map);
        map.fitBounds(routeLayer.getBounds());

        setStatus("Finding unprotected left turns...");
        const unprotectedIdxSet = await highlightUnprotectedLefts(route, leftLayer);

        renderRouteSteps(route, unprotectedIdxSet);

        setStatus("Done!");
    }

    return { map, buildRoute, clearRoute, leftLayer };
}