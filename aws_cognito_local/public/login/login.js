import { login } from "../auth-client.js";

const msg = document.getElementById("msg");
const btn = document.getElementById("btn");
const closeBtn = document.getElementById("loginClose");
const signupBtn = document.getElementById("navSignupBtn");

const urlParams = new URLSearchParams(window.location.search);
const returnTo = urlParams.get("return") || "/index.html";

function goBack() {
  window.location.href = returnTo;
}

if (closeBtn) {
  closeBtn.addEventListener("click", goBack);
}

if (signupBtn) {
  signupBtn.href = "/signup/?return=" + encodeURIComponent(returnTo);
}

btn.addEventListener("click", async () => {
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