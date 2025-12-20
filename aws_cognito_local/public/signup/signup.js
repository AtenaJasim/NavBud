import { signup } from "../auth-client.js";

const msg = document.getElementById("msg");
const btn = document.getElementById("btn");
const closeBtn = document.getElementById("signupClose");

const params = new URLSearchParams(window.location.search);
const returnTo = params.get("return") || "/index.html";

function goBack() {
    window.location.href = returnTo;
}

if (closeBtn) {
    closeBtn.addEventListener("click", goBack);
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") goBack();
});

btn.addEventListener("click", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        msg.textContent = "Please enter email and password";
        return;
    }

    try {
        msg.textContent = "Creating account...";
        await signup(email, password);
        goBack();
    } catch (err) {
        msg.textContent = err.message || "Signup failed";
    }
});
