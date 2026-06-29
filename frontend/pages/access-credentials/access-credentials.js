import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";
import {
  createCredential,
  deleteCredential,
  getCredentials,
  getSessionUser,
  updateCredential,
} from "../../shared/js/api.js";

const ROLE_LABELS = {
  admin: "Admin",
  country_manager: "Country Manager",
  dealer: "Dealer",
};

renderNavbar();
renderSidebar({ active: "credentials", variant: "admin" });
bindBackButtons();

const sessionUser = getSessionUser();
const addCredentialButton = document.getElementById("addCredentialButton");
const cancelCredentialButton = document.getElementById("cancelCredentialButton");
const credentialForm = document.getElementById("credentialForm");
const credentialId = document.getElementById("credentialId");
const credentialName = document.getElementById("credentialName");
const credentialEmail = document.getElementById("credentialEmail");
const credentialRole = document.getElementById("credentialRole");
const credentialPassword = document.getElementById("credentialPassword");
const credentialDealerCode = document.getElementById("credentialDealerCode");
const credentialCountryCode = document.getElementById("credentialCountryCode");
const credentialActive = document.getElementById("credentialActive");
const credentialsTableBody = document.getElementById("credentialsTableBody");
const accessMessage = document.getElementById("accessMessage");

let credentials = [];

function setMessage(message, isError = false) {
  accessMessage.textContent = message;
  accessMessage.classList.toggle("error", isError);
}

function requireAdmin() {
  if (!sessionUser || sessionUser.role !== "admin") {
    window.location.href = "../login/login.html";
    return false;
  }

  return true;
}

function showForm(user = null) {
  credentialForm.hidden = false;
  credentialId.value = user?.id || "";
  credentialName.value = user?.name || "";
  credentialEmail.value = user?.email || "";
  credentialRole.value = user?.role || "dealer";
  credentialPassword.value = "";
  credentialDealerCode.value = user?.dealerCode || "";
  credentialCountryCode.value = user?.countryCode || "";
  credentialActive.value = String(user?.active !== false);
  credentialPassword.required = !user;
  credentialPassword.placeholder = user ? "Leave blank to keep password" : "";
  credentialName.focus();
}

function hideForm() {
  credentialForm.reset();
  credentialId.value = "";
  credentialForm.hidden = true;
  credentialPassword.required = false;
}

function renderCredentials() {
  if (credentials.length === 0) {
    credentialsTableBody.innerHTML = `
      <tr>
        <td colspan="7">No credentials created yet.</td>
      </tr>
    `;
    return;
  }

  credentialsTableBody.innerHTML = credentials
    .map(function (user, index) {
      return `
        <tr>
          <td>${index + 1}</td>
          <td title="${user.name}">${user.name}</td>
          <td>${ROLE_LABELS[user.role] || user.role}</td>
          <td title="${user.email}">${user.email}</td>
          <td>Stored securely</td>
          <td>${user.active === false ? "Inactive" : "Active"}</td>
          <td>
            <div class="row-actions">
              <button class="row-action edit" type="button" data-edit-id="${user.id}">Edit</button>
              <button class="row-action delete" type="button" data-delete-id="${user.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadCredentials() {
  try {
    setMessage("");
    const data = await getCredentials();
    credentials = data.users;
    renderCredentials();
  } catch (error) {
    setMessage(error.message, true);
    credentialsTableBody.innerHTML = `
      <tr>
        <td colspan="7">Unable to load credentials.</td>
      </tr>
    `;
  }
}

credentialForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const payload = {
    name: credentialName.value.trim(),
    email: credentialEmail.value.trim(),
    role: credentialRole.value,
    dealerCode: credentialDealerCode.value.trim(),
    countryCode: credentialCountryCode.value.trim(),
    active: credentialActive.value === "true",
  };

  if (credentialPassword.value.trim()) {
    payload.password = credentialPassword.value.trim();
  }

  try {
    if (credentialId.value) {
      await updateCredential(credentialId.value, payload);
      setMessage("Credential updated.");
    } else {
      await createCredential(payload);
      setMessage("Credential added.");
    }

    hideForm();
    await loadCredentials();
  } catch (error) {
    setMessage(error.message, true);
  }
});

addCredentialButton.addEventListener("click", function () {
  setMessage("");
  showForm();
});

cancelCredentialButton.addEventListener("click", function () {
  hideForm();
  setMessage("");
});

credentialsTableBody.addEventListener("click", async function (event) {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (editButton) {
    const user = credentials.find((item) => item.id === editButton.dataset.editId);
    setMessage("");
    showForm(user);
    return;
  }

  if (deleteButton) {
    const user = credentials.find((item) => item.id === deleteButton.dataset.deleteId);
    const confirmed = window.confirm(`Delete credentials for ${user.name}?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteCredential(deleteButton.dataset.deleteId);
      setMessage("Credential deleted.");
      await loadCredentials();
    } catch (error) {
      setMessage(error.message, true);
    }
  }
});

document.querySelectorAll("[data-secondary-back-button]").forEach(function (button) {
  button.addEventListener("click", function () {
    window.history.back();
  });
});

if (requireAdmin()) {
  loadCredentials();
}
