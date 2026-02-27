// Use Geocode to convert text addresses into {lat, lon, displayName}
export async function geocode(query) {
    const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
            q: query,
            format: "json",
            limit: 1,
            addressdetails: 1,
        });

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
    });

    const data = await res.json();
    if (!data.length) {
        throw new Error("No results for: " + query);
    }

    const item = data[0];
    return {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        displayName: item.display_name,
    };
}

// Use OSRM to compute the route
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

// Get traffic light data from Overpass in a bbox
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
        body: query,
    });

    const data = await res.json();
    if (!data.elements) return [];

    return data.elements.map((el) => ({
        lat: el.lat,
        lon: el.lon,
    }));
}