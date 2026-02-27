export function initHistoryUI({
    historyButton,
    historySidebar,
    sidebarClose,
    historyList,
    startInput,
    endInput,
    onPickRoute, // async (item) => void
} = {}) {
    const routeHistory = [];
    const MAX_HISTORY_ITEMS = 10;

    function openHistorySidebar() {
        if (historySidebar) historySidebar.classList.add("open");
    }

    function closeHistorySidebar() {
        if (historySidebar) historySidebar.classList.remove("open");
    }

    function renderHistory() {
        if (!historyList) return;

        historyList.innerHTML = "";

        routeHistory.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = `${item.startText} → ${item.endText}`;
            li.title = `${item.startPlace.displayName} → ${item.endPlace.displayName}`;

            li.addEventListener("click", async () => {
                closeHistorySidebar();

                if (startInput) startInput.value = item.startText;
                if (endInput) endInput.value = item.endText;

                if (onPickRoute) {
                    await onPickRoute(item);
                }
            });

            historyList.appendChild(li);
        });
    }

    function addRouteToHistory(startText, endText, startPlace, endPlace) {
        const key = `${startText}||${endText}`;

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
                endPlace,
            });
        }

        if (routeHistory.length > MAX_HISTORY_ITEMS) {
            routeHistory.length = MAX_HISTORY_ITEMS;
        }

        renderHistory();
    }

    // Button handlers
    if (historyButton) {
        historyButton.addEventListener("click", () => openHistorySidebar());
    }

    if (sidebarClose) {
        sidebarClose.addEventListener("click", () => closeHistorySidebar());
    }

    // Escape closes
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeHistorySidebar();
    });

    return {
        addRouteToHistory,
        openHistorySidebar,
        closeHistorySidebar,
    };
}