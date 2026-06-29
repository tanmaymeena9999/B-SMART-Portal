import { login, saveSession } from "../../shared/js/api.js";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");
const marutiLoginBtn = document.getElementById("marutiLoginBtn");

function getRedirectPath(role) {
  if (role === "admin") {
    return "../dashboard/dashboard.html";
  }

  if (role === "country_manager") {
    return "../view-report/view-report.html";
  }

  return "../retail-service-report/retail-service-report.html";
}

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  loginError.textContent = "";

  if (!email || !password) {
    loginError.textContent = "Please enter email and password.";
    return;
  }

  if (!emailInput.checkValidity()) {
    loginError.textContent = "Please enter a valid email address.";
    return;
  }

  try {
    const session = await login(email, password);
    saveSession(session);
    window.location.href = getRedirectPath(session.user.role);
  } catch (error) {
    loginError.textContent = error.message;
  }
});

marutiLoginBtn.addEventListener("click", function () {
  loginError.textContent = "Maruti ID login will be connected later.";
});
