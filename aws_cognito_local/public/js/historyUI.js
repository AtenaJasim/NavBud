export function createHistoryUI({
    historyButton,
    historySidebar,
    sidebarClose,
    historyList,
    routeHistory,
    onPick
}) {
    function open() {
        historySidebar?.classList.add("open");
    }

    function close() {
        historySidebar?.classList.remove("open");
    }

    function render() {
        if (!historyList) return;

        historyList.innerHTML = "";

        routeHistory.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = `${item.startText} → ${item.endText}`;
            li.title = `${item.startPlace.displayName} → ${item.endPlace.displayName}`;

            li.addEventListener("click", () => {
                close();
                onPick(item);
            });

            historyList.appendChild(li);
        });
    }

    function add({ startText, endText, startPlace, endPlace, maxItems, onChange }) {
        const key = `${startText}||${endText}`;

        const existingIndex = routeHistory.findIndex((item) => item.key === key);
        if (existingIndex !== -1) {
            const [existing] = routeHistory.splice(existingIndex, 1);
            routeHistory.unshift(existing);
        } else {
            routeHistory.unshift({ key, startText, endText, startPlace, endPlace });
        }

        if (routeHistory.length > maxItems) {
            routeHistory.length = maxItems;
        }

        render();
        onChange?.();
    }

    function clear() {
        routeHistory.length = 0;
        render();
        close();
    }

    historyButton?.addEventListener("click", open);
    sidebarClose?.addEventListener("click", close);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
    });

    return { open, close, render, add, clear };
}