import { showDialog } from "./dialog.js";
import { getSessionUser, reviewMonthlyReport } from "../shared/js/api.js";

const STATUS_LABELS = {
  draft: "Draft",
  uploaded: "Submitted",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  correction_required: "Correction Required",
};

const TIMELINE_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeStatus(status = "") {
  return status === "uploaded" ? "submitted" : status || "draft";
}

function getTimelineIndex(status = "") {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "correction_required") {
    return 1;
  }

  return Math.max(0, TIMELINE_STEPS.findIndex((step) => step.key === normalizedStatus));
}

function getReportId(report = {}) {
  return report?.id || report?.reportKey || report?.objectId || "";
}

function canReviewReport(user, report) {
  return Boolean(getReportId(report) && ["admin", "country_manager"].includes(user?.role));
}

function renderTimeline(status = "") {
  const normalizedStatus = normalizeStatus(status);
  const currentIndex = getTimelineIndex(normalizedStatus);

  return TIMELINE_STEPS.map((step, index) => {
    const stateClass = index < currentIndex
      ? "is-complete"
      : index === currentIndex
        ? "is-current"
        : "is-pending";

    return `
      <li class="review-step ${stateClass}">
        <span class="review-step-marker" aria-hidden="true">${index + 1}</span>
        <span>${step.label}</span>
      </li>
    `;
  }).join("");
}

export function renderReviewPanel({ report, target = ".report-card", onReviewed } = {}) {
  const user = getSessionUser();
  const container = document.querySelector(target);
  const existingPanel = document.getElementById("reviewPanel");

  if (existingPanel) {
    existingPanel.remove();
  }

  if (!container || !canReviewReport(user, report)) {
    return;
  }

  const reportId = getReportId(report);
  const status = normalizeStatus(report.status);
  const statusLabel = STATUS_LABELS[report.status] || STATUS_LABELS[status] || "Draft";
  const comments = report.reviewComments || "";
  const isApproved = status === "approved";

  const panel = document.createElement("section");
  panel.className = "review-panel";
  panel.id = "reviewPanel";
  panel.setAttribute("aria-label", "Report review panel");
  panel.innerHTML = `
    <div class="review-panel-head">
      <div>
        <h2>Review Status</h2>
        <span class="review-status-badge ${status === "correction_required" ? "needs-correction" : ""}">
          ${escapeHtml(statusLabel)}
        </span>
      </div>
      <ol class="review-timeline">
        ${renderTimeline(status)}
      </ol>
    </div>

    <label class="review-comment-field">
      <span>Review Comments</span>
      <textarea
        id="reviewComments"
        rows="3"
        placeholder="Add review notes or correction feedback for the distributor.">${escapeHtml(comments)}</textarea>
    </label>

    <div class="review-actions">
      <button class="review-secondary-button" type="button" data-review-action="under_review" ${isApproved ? "disabled" : ""}>
        Mark Under Review
      </button>
      <button class="review-approve-button" type="button" data-review-action="approve" ${isApproved ? "disabled" : ""}>
        Approve
      </button>
      <button class="review-sendback-button is-disabled" type="button" data-review-action="send_back" aria-disabled="true">
        Send Back for Correction
      </button>
    </div>
  `;

  const tabs = container.querySelector(".report-tabs");
  if (tabs?.nextSibling) {
    container.insertBefore(panel, tabs.nextSibling);
  } else {
    container.prepend(panel);
  }

  const commentsInput = panel.querySelector("#reviewComments");
  const sendBackButton = panel.querySelector("[data-review-action='send_back']");

  function syncSendBackState() {
    const hasComments = commentsInput.value.trim().length > 0;
    sendBackButton.classList.toggle("is-disabled", !hasComments);
    sendBackButton.setAttribute("aria-disabled", String(!hasComments));
  }

  commentsInput.disabled = false;
  commentsInput.readOnly = false;
  commentsInput.addEventListener("input", syncSendBackState);
  syncSendBackState();

  panel.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-review-action]");

    if (!actionButton || actionButton.disabled) {
      return;
    }

    const action = actionButton.dataset.reviewAction;
    const reviewComments = commentsInput.value.trim();

    if (action === "send_back" && !reviewComments) {
      window.alert("Please provide review comments before sending this report back for correction.");
      commentsInput.focus();
      return;
    }

    try {
      panel.querySelectorAll("[data-review-action]").forEach((button) => {
        button.disabled = true;
      });

      const data = await reviewMonthlyReport({
        id: reportId,
        action,
        comments: reviewComments,
      });

      await showDialog({
        title: action === "send_back" ? "Sent Back for Correction" : "Review Updated",
        message: action === "send_back"
          ? "The distributor will see your correction notes on this report."
          : "The report review status has been updated.",
        buttonText: "Done",
      });

      renderReviewPanel({ report: data.report, target, onReviewed });

      if (typeof onReviewed === "function") {
        onReviewed(data.report);
      }
    } catch (error) {
      window.alert(error.message);
      panel.querySelectorAll("[data-review-action]").forEach((button) => {
        button.disabled = false;
      });
      syncSendBackState();
    }
  });
}
