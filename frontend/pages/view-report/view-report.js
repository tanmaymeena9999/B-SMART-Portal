import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";
import { getMonthlyReports, getSessionUser } from "../../shared/js/api.js";

renderNavbar();
renderSidebar({ variant: "view" });
bindBackButtons();

const reportsTableBody = document.getElementById("reportsTableBody");
const sessionUser = getSessionUser();
const canEditReports = sessionUser?.role !== "country_manager";

const reportLabels = {
  retail_service_activity: "Retail Service Activity Report",
  additional_kpi: "Additional KPI Report",
  vin_retention: "VIN Retention",
};

const reportEditPaths = {
  retail_service_activity: "../retail-service-report/retail-service-report.html",
  additional_kpi: "../additional-kpi/additional-kpi.html",
  vin_retention: "../vin-retention/vin-retention.html",
};

const reportTypeOrder = Object.keys(reportLabels);
const expandedReportGroups = new Set();

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function getReportPath(report, { mode = "edit" } = {}) {
  const path = reportEditPaths[report.reportType] || reportEditPaths.retail_service_activity;
  const query = new URLSearchParams({ reportMonth: report.reportMonth });
  const dealerCode = report.dealerCode || report.distributorCode;

  if (mode === "view") {
    query.set("mode", "view");
  } else {
    query.set("mode", "edit");
  }

  if (dealerCode) {
    query.set("dealerCode", dealerCode);
  }

  return `${path}?${query.toString()}`;
}

function enforceReadOnlyReportPath(path = "") {
  const url = new URL(path, window.location.href);
  url.searchParams.set("mode", "view");
  return `${url.pathname}${url.search}${url.hash}`;
}

function getReportLabel(reportType = "") {
  return reportLabels[reportType] || reportType || "Other Reports";
}

function getGroupedReports(reports = []) {
  const grouped = reports.reduce((groups, report) => {
    const category = report.reportType || "other";

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category).push(report);
    return groups;
  }, new Map());

  return Array.from(grouped.entries())
    .map(([category, categoryReports]) => ({ category, reports: categoryReports }))
    .sort((first, second) => {
      const firstIndex = reportTypeOrder.indexOf(first.category);
      const secondIndex = reportTypeOrder.indexOf(second.category);

      if (firstIndex === -1 && secondIndex === -1) {
        return getReportLabel(first.category).localeCompare(getReportLabel(second.category));
      }

      if (firstIndex === -1) {
        return 1;
      }

      if (secondIndex === -1) {
        return -1;
      }

      return firstIndex - secondIndex;
    });
}

function renderCategoryHeader({ category, groupId, reports, collapsed }) {
  const reportCount = reports.length;

  return `
    <tr class="report-category-row">
      <td colspan="5">
        <button
          class="report-category-toggle"
          type="button"
          data-report-category-toggle="${escapeHtml(groupId)}"
          data-report-category="${escapeHtml(category)}"
          aria-expanded="${String(!collapsed)}">
          <span class="category-toggle-mark" aria-hidden="true">${collapsed ? "+" : "-"}</span>
          <span>${escapeHtml(getReportLabel(category))}</span>
          <span class="category-count">${reportCount} ${reportCount === 1 ? "report" : "reports"}</span>
        </button>
      </td>
    </tr>
  `;
}

function renderReportRow(report, index, groupId, collapsed) {
  const isExcel = report.source === "excel";
  const editReportPath = getReportPath(report);
  const viewReportPath = getReportPath(report, { mode: "view" });
  const sourceLabel = isExcel ? "Excel upload" : "Manual input";
  const dealerCode = report.dealerCode || report.distributorCode;

  return `
    <tr class="report-data-row ${collapsed ? "is-hidden" : ""}" data-report-group="${escapeHtml(groupId)}">
      <td>${index + 1}</td>
      <td>
        <div>${escapeHtml(report.dealerName || "Dealer")}</div>
        ${dealerCode ? `<span class="updated-date">${escapeHtml(dealerCode)}</span>` : ""}
      </td>
      <td>
        <div>${escapeHtml(getReportLabel(report.reportType))}</div>
        <span class="source-badge ${isExcel ? "source-excel" : "source-manual"}">${sourceLabel}</span>
      </td>
      <td>
        <div>${escapeHtml(report.reportMonth || "")}</div>
        <span class="updated-date">${escapeHtml(formatDate(report.updatedAt))}</span>
      </td>
      <td>
        <div class="action-buttons">
          ${canEditReports ? `
            <button
              class="edit-button"
              type="button"
              data-edit-report="${escapeHtml(editReportPath)}"
              title="Edit report">
              Edit <span aria-hidden="true">↗</span>
            </button>
          ` : ""}
          <button class="view-button" type="button" data-view-report="${escapeHtml(viewReportPath)}">
            View <span aria-hidden="true">●</span>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderReports(reports = []) {
  if (!reports.length) {
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="5">No reports found.</td>
      </tr>
    `;
    return;
  }

  let reportIndex = 0;

  reportsTableBody.innerHTML = getGroupedReports(reports)
    .map((group, groupIndex) => {
      const groupId = `report-group-${groupIndex}`;
      const collapsed = !expandedReportGroups.has(group.category);
      const categoryHeader = renderCategoryHeader({ ...group, groupId, collapsed });
      const reportRows = group.reports
        .map((report) => renderReportRow(report, reportIndex++, groupId, collapsed))
        .join("");

      return `${categoryHeader}${reportRows}`;
    })
    .join("");
}

reportsTableBody.addEventListener("click", (event) => {
  const categoryToggle = event.target.closest("[data-report-category-toggle]");

  if (categoryToggle) {
    const groupId = categoryToggle.dataset.reportCategoryToggle;
    const category = categoryToggle.dataset.reportCategory;
    const isExpanded = categoryToggle.getAttribute("aria-expanded") === "true";
    const groupRows = reportsTableBody.querySelectorAll(`[data-report-group="${groupId}"]`);

    categoryToggle.setAttribute("aria-expanded", String(!isExpanded));
    categoryToggle.querySelector(".category-toggle-mark").textContent = isExpanded ? "+" : "-";
    groupRows.forEach((row) => row.classList.toggle("is-hidden", isExpanded));

    if (isExpanded) {
      expandedReportGroups.delete(category);
    } else {
      expandedReportGroups.add(category);
    }

    return;
  }

  const editButton = event.target.closest("[data-edit-report]");
  const viewButton = event.target.closest("[data-view-report]");

  if (viewButton) {
    window.location.href = enforceReadOnlyReportPath(viewButton.dataset.viewReport);
    return;
  }

  if (editButton) {
    window.location.href = editButton.dataset.editReport;
  }
});

async function loadReports() {
  try {
    const data = await getMonthlyReports({
      period: "all",
      submittedOnly: true,
    });
    renderReports(data.reports || []);
  } catch (error) {
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="5">${escapeHtml(error.message)}</td>
      </tr>
    `;
  }
}

loadReports();
