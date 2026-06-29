const fillReportItems = [
  {
    id: "retail",
    href: "../retail-service-report/retail-service-report.html",
    icon: "/icons/retail-service.svg",
    label: "Retail<br />Service<br />Activity<br />Report",
  },
  {
    id: "additional",
    href: "../additional-kpi/additional-kpi.html",
    icon: "/icons/additional-kpi.svg",
    label: "Additional<br />KPI Report",
  },
  {
    id: "vin",
    href: "../vin-retention/vin-retention.html",
    icon: "/icons/vin-retention.svg",
    label: "VIN<br />Retention",
  },
];

function getStoredUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("bsmartUser") || "null");
    return user?.role || "";
  } catch (error) {
    return "";
  }
}

function renderFillReportSidebar(active) {
  const reportLinks = fillReportItems
    .map(function (item, index) {
      const separator = index > 0 ? '<span class="nav-separator"></span>' : "";
      const stateClass = item.id === active ? "active" : "muted";

      return `
        ${separator}
        <a class="nav-item ${stateClass}" href="${item.href}">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="${item.icon}" alt=""></span>
          <span>${item.label}</span>
        </a>
      `;
    })
    .join("");

  return `
    <aside class="side-nav" aria-label="Report navigation">
      <div class="nav-group">
        <button class="nav-item fill-report" type="button" data-fill-toggle aria-expanded="true">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/fill-report.svg" alt=""></span>
          <span>Fill<br />Report</span>
        </button>
        <div class="fill-report-options" data-fill-options>
          ${reportLinks}
        </div>
      </div>

      <div class="nav-footer">
        <a class="nav-item muted view-report" href="../view-report/view-report.html">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/view-report.svg" alt=""></span>
          <span>View<br />Report</span>
        </a>
        <button class="back-button" type="button" data-back-button>
          <span aria-hidden="true">&lt;</span>
          Back
        </button>
      </div>
    </aside>
  `;
}

function renderViewSidebar(active = "view", role = "") {
  const viewState = active === "view" ? "active" : "muted";
  const dashboardState = active === "dashboard" ? "active" : "muted";
  const canFillReports = role !== "country_manager";

  return `
    <aside class="side-nav view-nav" aria-label="View report navigation">
      <div class="view-nav-items">
        ${canFillReports ? `
          <button class="nav-item muted fill-report" type="button" data-fill-toggle aria-expanded="false">
            <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/fill-report.svg" alt=""></span>
            <span>Fill<br />Report</span>
          </button>
          <div class="fill-report-options collapsed" data-fill-options>
            ${fillReportItems
              .map(function (item) {
                return `
                  <a class="nav-item muted" href="${item.href}">
                    <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="${item.icon}" alt=""></span>
                    <span>${item.label}</span>
                  </a>
                `;
              })
              .join('<span class="nav-separator"></span>')}
          </div>
        ` : ""}
        <a class="nav-item ${viewState}" href="../view-report/view-report.html">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/view-report.svg" alt=""></span>
          <span>View<br />Report</span>
        </a>
        <span class="nav-separator"></span>
        ${role === "admin" ? `
          <a class="nav-item ${dashboardState}" href="../dashboard/dashboard.html">
            <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/dashboard.svg" alt=""></span>
            <span>Dashboard</span>
          </a>
        ` : ""}
      </div>

      <button class="back-button" type="button" data-back-button>
        <span aria-hidden="true">&lt;</span>
        Back
      </button>
    </aside>
  `;
}

function renderAdminSidebar(active = "dashboard") {
  const dashboardState = active === "dashboard" ? "active" : "muted";
  const viewState = active === "view" ? "active" : "muted";
  const credentialsState = active === "credentials" ? "active" : "muted";

  return `
    <aside class="side-nav view-nav admin-nav" aria-label="Admin navigation">
      <div class="view-nav-items">
        <a class="nav-item ${dashboardState}" href="../dashboard/dashboard.html">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/dashboard.svg" alt=""></span>
          <span>Master</span>
        </a>
        <span class="nav-separator"></span>
        <a class="nav-item ${viewState}" href="../view-report/view-report.html">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/view-report.svg" alt=""></span>
          <span>View<br />Report</span>
        </a>
        <span class="nav-separator"></span>
        <a class="nav-item ${credentialsState}" href="../access-credentials/access-credentials.html">
          <span class="nav-icon" aria-hidden="true"><img class="nav-icon-image" src="/icons/view-report.svg" alt=""></span>
          <span>Access<br />Credentials</span>
        </a>
      </div>

      <button class="back-button" type="button" data-back-button>
        <span aria-hidden="true">&lt;</span>
        Back
      </button>
    </aside>
  `;
}

export function renderSidebar({ target = "#appSidebar", active = "retail", variant = "fill" } = {}) {
  const container = document.querySelector(target);
  const role = getStoredUserRole();

  if (!container) {
    return;
  }

  if (variant === "admin") {
    container.outerHTML = renderAdminSidebar(active);
  } else {
    container.outerHTML = variant === "view" || role === "country_manager"
      ? renderViewSidebar(active, role)
      : renderFillReportSidebar(active);
  }

  bindFillReportToggle();
}

export function bindBackButtons(selector = "[data-back-button]") {
  document.querySelectorAll(selector).forEach(function (button) {
    button.addEventListener("click", function () {
      window.history.back();
    });
  });
}

function bindFillReportToggle() {
  document.querySelectorAll("[data-fill-toggle]").forEach(function (button) {
    button.addEventListener("click", function () {
      const options = button.parentElement.querySelector("[data-fill-options]");

      if (!options) {
        return;
      }

      const isCollapsed = options.classList.toggle("collapsed");
      button.setAttribute("aria-expanded", String(!isCollapsed));
    });
  });
}
