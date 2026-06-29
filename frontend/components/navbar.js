import { clearSession, getSessionUser } from "../shared/js/api.js";
import { showLoader } from "./loader.js";

const ROLE_LABELS = {
  admin: "Admin",
  country_manager: "Country Manager",
  dealer: "Dealer",
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(name = "", email = "") {
  const source = name || email;
  const words = source.split(/[\s@.]+/).filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function bindNavbarActions() {
  const profileButton = document.querySelector("[data-profile-button]");
  const profilePanel = document.querySelector("[data-profile-panel]");
  const logoutButton = document.querySelector("[data-logout-button]");

  if (profileButton && profilePanel) {
    profileButton.addEventListener("click", function (event) {
      event.stopPropagation();
      profilePanel.hidden = !profilePanel.hidden;
    });

    profilePanel.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    document.addEventListener("click", function () {
      profilePanel.hidden = true;
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      showLoader("Signing out...");
      clearSession();
      window.setTimeout(() => {
        window.location.href = "../login/login.html";
      }, 250);
    });
  }
}

export function renderNavbar(target = "#appNavbar") {
  const container = document.querySelector(target);

  if (!container) {
    return;
  }

  const user = getSessionUser() || {};
  const userName = user.name || "User";
  const userEmail = user.email || "Not signed in";
  const userRole = ROLE_LABELS[user.role] || "User";
  const userMeta = user.dealerCode || user.countryCode || userRole;
  const initials = getInitials(userName, userEmail);

  container.outerHTML = `
    <header class="topbar">
      <div class="brand" aria-label="Maruti Suzuki logo placeholder">
        <span class="brand-logo-slot" aria-hidden="true"></span>
      </div>

      <div class="top-actions">
        <img
          class="powered-logo-slot"
          src="/images/powered.svg"
          alt="Powered by logo">
        <span class="divider"></span>
        <button class="icon-circle" type="button" aria-label="Notifications">
          <img class="icon-image" src="/icons/bell.svg" alt="">
        </button>
        <span class="divider"></span>
        <div class="profile-menu">
          <button class="user-profile-button" type="button" data-profile-button aria-label="View profile">
            <span class="user-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
          </button>
          <div class="profile-panel" data-profile-panel hidden>
            <div class="profile-panel-head">
              <span class="profile-panel-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
              <div>
                <strong>${escapeHtml(userName)}</strong>
                <span>${escapeHtml(userRole)}</span>
              </div>
            </div>
            <div class="profile-detail-row">
              <span>Email</span>
              <strong>${escapeHtml(userEmail)}</strong>
            </div>
            ${user.dealerCode ? `
              <div class="profile-detail-row">
                <span>Dealer Code</span>
                <strong>${escapeHtml(user.dealerCode)}</strong>
              </div>
            ` : ""}
            ${user.countryCode ? `
              <div class="profile-detail-row">
                <span>Country Code</span>
                <strong>${escapeHtml(user.countryCode)}</strong>
              </div>
            ` : ""}
          </div>
        </div>
        <button class="logout-button" type="button" data-logout-button>Logout</button>
      </div>
    </header>
  `;

  bindNavbarActions();
}
