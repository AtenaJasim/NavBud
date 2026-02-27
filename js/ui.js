export const els = {
    statusEl: document.getElementById("status"),
    routePanel: document.getElementById("routePanel"),
    routeStepsEl: document.getElementById("routeSteps"),
    routeTimeEl: document.getElementById("routeTime"),

    routeForm: document.getElementById("routeForm"),
    startInput: document.getElementById("startText"),
    endInput: document.getElementById("endText"),

    historyButton: document.getElementById("historyButton"),
    historySidebar: document.getElementById("historySidebar"),
    sidebarClose: document.getElementById("sidebarClose"),
    historyList: document.getElementById("historyList"),
};

export function setStatus(msg) {
    if (els.statusEl) els.statusEl.textContent = msg || "";
}

export function openRouteUI(map) {
    document.body.classList.add("show-route");
    if (els.routePanel) els.routePanel.classList.add("visible");

    // Leaflet needs this after the map container width changes
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 200);
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "";
    const minsTotal = Math.round(seconds / 60);
    const hrs = Math.floor(minsTotal / 60);
    const mins = minsTotal % 60;

    if (hrs <= 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
}

function formatStepText(step) {
    const name = step && step.name ? step.name : "road";
    const m = step.maneuver || {};
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
    if (type === "end of road")
        return `At the end of the road, turn ${mod || ""} onto ${name}`.replace(/\s+/g, " ").trim();

    return `${type} ${mod} ${name}`.replace(/\s+/g, " ").trim();
}

export function renderRouteSteps(route, unprotectedIdxSet) {
    if (!els.routeStepsEl || !els.routeTimeEl) return;

    els.routeTimeEl.textContent = formatDuration(route.duration);

    els.routeStepsEl.innerHTML = "";
    const steps = route.legs.flatMap((l) => l.steps);

    steps.forEach((step, idx) => {
        const li = document.createElement("li");

        if (unprotectedIdxSet && unprotectedIdxSet.has(idx)) {
            const street = step.name || "road";

            const red = document.createElement("span");
            red.className = "unprotected-left";
            red.textContent = "Unprotected left";

            li.appendChild(red);
            li.appendChild(document.createTextNode(` onto ${street}`));
        } else {
            li.textContent = formatStepText(step);
        }

        els.routeStepsEl.appendChild(li);
    });
}

// Pressing Enter in the end box submits the form
export function enableEnterToSubmit() {
    if (!els.routeForm || !els.endInput) return;

    els.endInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            els.routeForm.requestSubmit();
        }
    });
}