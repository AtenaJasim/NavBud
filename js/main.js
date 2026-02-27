import { geocode, getRoute } from "./api.js";
import { initHistoryUI } from "./historyUI.js";
import { initMapController } from "./mapController.js";
import { els, enableEnterToSubmit, openRouteUI, renderRouteSteps, setStatus } from "./ui.js";

const mapCtrl = initMapController();

// shared runner (used by submit + history click)
async function buildAndDisplayRoute({ startText, endText, startPlace, endPlace, addToHistory }) {
    mapCtrl.resetRoute();
    mapCtrl.setMarkers(startPlace, endPlace);

    setStatus("Getting route...");
    const route = await getRoute(startPlace, endPlace);

    mapCtrl.drawRoute(route);

    setStatus("Finding unprotected left turns...");
    const unprotectedIdxSet = await mapCtrl.highlightUnprotectedLefts(route);

    renderRouteSteps(route, unprotectedIdxSet);
    setStatus("Done!");

    if (addToHistory) {
        history.addRouteToHistory(startText, endText, startPlace, endPlace);
    }
}

const history = initHistoryUI({
    historyButton: els.historyButton,
    historySidebar: els.historySidebar,
    sidebarClose: els.sidebarClose,
    historyList: els.historyList,
    startInput: els.startInput,
    endInput: els.endInput,
    onPickRoute: async (item) => {
        openRouteUI(mapCtrl.map);
        setStatus("");

        try {
            setStatus("Loading route from history...");
            await buildAndDisplayRoute({
                startText: item.startText,
                endText: item.endText,
                startPlace: item.startPlace,
                endPlace: item.endPlace,
                addToHistory: false,
            });
        } catch (err) {
            console.error(err);
            alert(err.message || "There was a problem loading this route.");
            setStatus("");
        }
    },
});

enableEnterToSubmit();

if (els.routeForm) {
    els.routeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setStatus("");

        const startText = (els.startInput?.value || "").trim();
        const endText = (els.endInput?.value || "").trim();

        if (!startText || !endText) {
            alert("Please enter both start and end.");
            return;
        }

        openRouteUI(mapCtrl.map);

        try {
            setStatus("Finding locations...");

            const [startPlace, endPlace] = await Promise.all([
                geocode(startText),
                geocode(endText),
            ]);

            await buildAndDisplayRoute({
                startText,
                endText,
                startPlace,
                endPlace,
                addToHistory: true,
            });
        } catch (err) {
            console.error(err);
            alert(err.message || "There was a problem finding the route.");
            setStatus("");
        }
    });
}