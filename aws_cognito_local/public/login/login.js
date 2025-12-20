import { login } from "../auth-client.js";

const msg = document.getElementById("msg");
const btn = document.getElementById("btn");
const closeBtn = document.getElementById("loginClose");
const createLink = document.getElementById("createLink");

const urlParams = new URLSearchParams(window.location.search);
const returnTo = urlParams.get("return") || "/index.html";

if (createLink) {
    createLink.href = "/signup/?return=" + encodeURIComponent(returnTo);
}

function goBack() {
    window.location.href = returnTo;
}

if (closeBtn) {
    closeBtn.addEventListener("click", goBack);
}

btn.addEventListener("click", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
        msg.textContent = "Signing in...";
        await login(username, password);
        window.location.href = returnTo;
    } catch (err) {
        msg.textContent = err.message || "Login failed";
    }
});
