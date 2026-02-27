export const TOKEN_STORAGE_KEY = "navbud_local_tokens";

export function getIdTokenPayload() {
    try {
        const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!raw) return null;

        const tokens = JSON.parse(raw);
        const idToken = tokens?.id_token || tokens?.IdToken;
        if (!idToken) return null;

        const parts = idToken.split(".");
        if (parts.length < 2) return null;

        const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = atob(payloadB64);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function getHistoryKeyForUser() {
    const payload = getIdTokenPayload();
    const userId = payload?.sub || payload?.email || payload?.["cognito:username"];
    if (!userId) return null;
    return "navbud_history_" + userId;
}

export function loadUserHistoryInto(routeHistory, maxItems, renderHistory) {
    const key = getHistoryKeyForUser();
    if (!key) return;

    try {
        const raw = localStorage.getItem(key);
        if (!raw) return;

        const items = JSON.parse(raw);
        if (!Array.isArray(items)) return;

        routeHistory.length = 0;
        routeHistory.push(...items.slice(0, maxItems));
        renderHistory();
    } catch {
    }
}

export function saveUserHistory(routeHistory) {
    const key = getHistoryKeyForUser();
    if (!key) return;

    try {
        localStorage.setItem(key, JSON.stringify(routeHistory));
    } catch {
    }
}