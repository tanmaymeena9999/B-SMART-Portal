function ensureDialogStyles() {
  if (document.getElementById("appDialogStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "appDialogStyles";
  style.textContent = `
    .app-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.36);
      backdrop-filter: blur(3px);
    }

    .app-dialog {
      width: min(440px, 100%);
      color: #172554;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      box-shadow: 0 22px 54px rgba(30, 58, 138, 0.24);
      font-family: Arial, Helvetica, sans-serif;
      overflow: hidden;
    }

    .app-dialog-head {
      padding: 18px 20px 10px;
      border-bottom: 1px solid #e0ecff;
    }

    .app-dialog-head strong {
      display: block;
      font-size: 17px;
      line-height: 1.35;
    }

    .app-dialog-body {
      padding: 16px 20px 20px;
      color: #334155;
      font-size: 14px;
      line-height: 1.5;
    }

    .app-dialog-actions {
      display: flex;
      justify-content: flex-end;
      padding: 0 20px 18px;
    }

    .app-dialog-button {
      min-width: 96px;
      height: 38px;
      padding: 0 18px;
      color: #ffffff;
      background: #244bd1;
      border: 0;
      border-radius: 999px;
      font: 800 13px Arial, Helvetica, sans-serif;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

export function showDialog({ title = "Notice", message = "", buttonText = "OK" } = {}) {
  ensureDialogStyles();

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "app-dialog-backdrop";
    backdrop.innerHTML = `
      <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">
        <div class="app-dialog-head">
          <strong id="appDialogTitle"></strong>
        </div>
        <div class="app-dialog-body"></div>
        <div class="app-dialog-actions">
          <button class="app-dialog-button" type="button"></button>
        </div>
      </div>
    `;

    backdrop.querySelector("#appDialogTitle").textContent = title;
    backdrop.querySelector(".app-dialog-body").textContent = message;
    const button = backdrop.querySelector(".app-dialog-button");
    button.textContent = buttonText;

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeDialog();
      }
    }

    function closeDialog() {
      document.removeEventListener("keydown", handleEscape);
      backdrop.remove();
      resolve();
    }

    button.addEventListener("click", closeDialog);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeDialog();
      }
    });
    document.addEventListener("keydown", handleEscape);

    document.body.appendChild(backdrop);
    button.focus();
  });
}
