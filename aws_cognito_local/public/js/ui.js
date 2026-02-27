export function setStatus(statusEl, msg) {
    if (statusEl) statusEl.textContent = msg || "";
}

export function openRouteUI(routePanelEl, map) {
    document.body.classList.add("show-route");
    if (routePanelEl) routePanelEl.classList.add("visible");

    setTimeout(() => {
        map?.invalidateSize?.();
    }, 200);
}

export function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "";
    const minsTotal = Math.round(seconds / 60);
    const hrs = Math.floor(minsTotal / 60);
    const mins = minsTotal % 60;

    if (hrs <= 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
}

export function formatStepText(step) {
    const name = step?.name ? step.name : "road";
    const m = step?.maneuver || {};
    const type = String(m.type || "");
    const mod = String(m.modifier || "");

    if (type === "depart") return `Start on ${name}`;
    if (type === "arrive") return "Arrive at destination";
    if (type === "turn") return `Turn ${mod || ""} onto ${name}`.replace(/\s+/g, " ").trim();
    if (type === "continue") return `Continue on ${name}`;
    if (type === "merge") return `Merge ${mod || ""} onto ${name}`.replace(/\s+/g, " ").trim();
    if (type === "roundabout") return `Enter roundabout toward ${name}`;
    if (type === "fork") return `Keep ${mod || ""} to stay on ${name}`.replace(/\s+/g, " ").trim();
    if (type === "new name") return `Continue onto ${name}`;
    if (type === "end of road") {
        return `At the end of the road, turn ${mod || ""} onto ${name}`.replace(/\s+/g, " ").trim();
    }

    return `${type} ${mod} ${name}`.replace(/\s+/g, " ").trim();
}

export function renderRouteSteps({ route, unprotectedIdxSet, routeStepsEl, routeTimeEl }) {
    if (!routeStepsEl || !routeTimeEl) return;

    routeTimeEl.textContent = formatDuration(route.duration);

    routeStepsEl.innerHTML = "";
    const steps = route.legs.flatMap((l) => l.steps);

    steps.forEach((step, idx) => {
        const li = document.createElement("li");

        if (unprotectedIdxSet?.has(idx)) {
            const street = step.name || "road";

            const red = document.createElement("span");
            red.className = "unprotected-left";
            red.textContent = "Unprotected left";

            li.appendChild(red);
            li.appendChild(document.createTextNode(` onto ${street}`));
        } else {
            li.textContent = formatStepText(step);
        }

        routeStepsEl.appendChild(li);
    });
}

export function clearRoutePanel(routeStepsEl, routeTimeEl) {
    if (routeStepsEl) routeStepsEl.innerHTML = "";
    if (routeTimeEl) routeTimeEl.textContent = "";
}