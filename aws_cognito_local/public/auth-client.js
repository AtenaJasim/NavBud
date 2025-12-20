const TOKEN_KEY = "navbud_local_tokens";

function normalizeTokens(tokens) {
    if (!tokens) return null;
    return {
        access_token: tokens.access_token ?? tokens.AccessToken ?? null,
        id_token: tokens.id_token ?? tokens.IdToken ?? null,
        refresh_token: tokens.refresh_token ?? tokens.RefreshToken ?? null,
        expires_in: tokens.expires_in ?? tokens.ExpiresIn ?? null,
        token_type: tokens.token_type ?? tokens.TokenType ?? null
    };
}

export function saveTokens(tokens) {
    const norm = normalizeTokens(tokens);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(norm || {}));
}

export function loadTokens() {
    try {
        return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    } catch {
        return null;
    }
}

export function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
    const t = loadTokens();
    return !!(t && t.access_token && t.id_token);
}

export async function login(username, password) {
    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.error || "Login failed");

    saveTokens(data);
    return data;
}

export function attachNavButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const render = () => {
        if (isLoggedIn()) {
            btn.textContent = "Log out";
            btn.href = "#";
            btn.onclick = (e) => {
                e.preventDefault();
                clearTokens();
                window.dispatchEvent(new Event("navbud:logout"));
                render();
            };
        } else {
            btn.textContent = "Log in";
            const returnTo = window.location.pathname + window.location.search + window.location.hash;
            btn.href = "/login/?return=" + encodeURIComponent(returnTo);
            btn.onclick = null;
        }
    };
    render();
}

export async function signup(email, password) {
    const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.error || "Signup failed");

    saveTokens(data);
    return data;
}
