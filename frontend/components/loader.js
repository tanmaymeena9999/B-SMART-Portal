let activeLoads = 0;
let currentMessage = "Loading...";

function ensureLoader() {
  let loader = document.getElementById("globalLoader");

  if (loader) {
    return loader;
  }

  const style = document.createElement("style");
  style.textContent = `
    .global-loader {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.22);
      backdrop-filter: blur(2px);
    }

    .global-loader[hidden] {
      display: none;
    }

    .global-loader-box {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 0 18px;
      color: #173a97;
      background: #ffffff;
      border: 1px solid #b8d0ef;
      border-radius: 999px;
      box-shadow: 0 14px 32px rgba(42, 70, 134, 0.22);
      font: 800 14px Arial, Helvetica, sans-serif;
    }

    .global-loader-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #cfe0ff;
      border-top-color: #244bd1;
      border-radius: 50%;
      animation: global-loader-spin 800ms linear infinite;
    }

    @keyframes global-loader-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);

  loader = document.createElement("div");
  loader.id = "globalLoader";
  loader.className = "global-loader";
  loader.hidden = true;
  loader.innerHTML = `
    <div class="global-loader-box" role="status" aria-live="polite">
      <span class="global-loader-spinner" aria-hidden="true"></span>
      <span data-loader-message>Loading...</span>
    </div>
  `;
  document.body.appendChild(loader);

  return loader;
}

function setLoaderMessage(message = "Loading...") {
  currentMessage = message;
  const messageElement = ensureLoader().querySelector("[data-loader-message]");

  if (messageElement) {
    messageElement.textContent = currentMessage;
  }
}

export function showLoader(message = "Loading...") {
  activeLoads += 1;
  setLoaderMessage(message);
  ensureLoader().hidden = false;
}

export function hideLoader() {
  activeLoads = Math.max(0, activeLoads - 1);

  if (activeLoads === 0) {
    ensureLoader().hidden = true;
    setLoaderMessage("Loading...");
  }
}
