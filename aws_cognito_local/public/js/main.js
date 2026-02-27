import { attachNavButton } from "../auth-client.js";

import { geocode } from "./api.js";
import { createMapController } from "./mapController.js";
import { createHistoryUI } from "./historyUI.js";
import {
    loadUserHistoryInto,
    saveUserHistory
} from "./authStorage.js";
import {
    setStatus as setStatusUI,
    openRouteUI,
    renderRouteSteps as renderRouteStepsUI,
    clearRoutePanel
} from "./ui.js";

// Attach login/logout button behavior
attachNavButton("navAuthBtn");

// DOM
const statusEl = document.getElementById("status");
const routePanel = document.getElementById("routePanel");
const routeStepsEl = document.getElementById("routeSteps");
const routeTimeEl = document.getElementById("routeTime");

const routeForm = document.getElementById("routeForm");
const startInput = document.getElementById("startText");
const endInput = document.getElementById("endText");

const historyButton = document.getElementById("historyButton");
const historySidebar = document.getElementById("historySidebar");
const sidebarClose = document.getElementById("sidebarClose");
const historyList = document.getElementById("historyList");

// State
const routeHistory = [];
const MAX_HISTORY_ITEMS = 10;

// Map
const mapCtrl = createMapController("map");

// UI helpers
function setStatus(msg) {
    setStatusUI(statusEl, msg);
}

function renderRouteSteps(route, unprotectedIdxSet) {
    renderRouteStepsUI({ route, unprotectedIdxSet, routeStepsEl, routeTimeEl });
}

// History UI
const historyUI = createHistoryUI({
    historyButton,
    historySidebar,
    sidebarClose,
    historyList,
    routeHistory,
    onPick: async (item) => {
        startInput.value = item.startText;
        endInput.value = item.endText;

        openRouteUI(routePanel, mapCtrl.map);

        setStatus("");
        try {
            setStatus("Loading route from history...");
            await mapCtrl.buildRoute(item.startPlace, item.endPlace, {
                setStatus,
                renderRouteSteps
            });
        } catch (err) {
            console.error(err);
            alert(err.message || "There was a problem loading this route.");
            setStatus("");
        }
    }
});

// Enter to submit from end input
if (routeForm && endInput) {
    endInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            routeForm.requestSubmit();
        }
    });
}

// Submit handler
routeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");

    const startText = startInput.value.trim();
    const endText = endInput.value.trim();

    if (!startText || !endText) {
        alert("Please enter both start and end.");
        return;
    }

    openRouteUI(routePanel, mapCtrl.map);

    try {
        setStatus("Finding locations...");
        const [startPlace, endPlace] = await Promise.all([
            geocode(startText),
            geocode(endText)
        ]);

        await mapCtrl.buildRoute(startPlace, endPlace, {
            setStatus,
            renderRouteSteps
        });

        historyUI.add({
            startText,
            endText,
            startPlace,
            endPlace,
            maxItems: MAX_HISTORY_ITEMS,
            onChange: () => saveUserHistory(routeHistory)
        });
    } catch (err) {
        console.error(err);
        alert(err.message || "There was a problem finding the route.");
        setStatus("");
    }
});

// Load saved history for logged in user
loadUserHistoryInto(routeHistory, MAX_HISTORY_ITEMS, () => historyUI.render());

// Logout event from auth layer
window.addEventListener("navbud:logout", () => {
    historyUI.clear();
    clearRoutePanel(routeStepsEl, routeTimeEl);
});