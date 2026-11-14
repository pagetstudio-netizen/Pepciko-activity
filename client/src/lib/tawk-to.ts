const TAWK_SCRIPT_ID = "tawk-to-live-chat";
const TAWK_SCRIPT_URL = "https://embed.tawk.to/6af83ac6f2b1b13c471c2aea/1k7cqb6u9";

interface TawkApi {
  maximize?: () => void;
  onLoad?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let pendingOpen = false;
let loadHandlerRegistered = false;

export function loadTawkWidget() {
  if (typeof window === "undefined") return;

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();

  if (document.getElementById(TAWK_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = TAWK_SCRIPT_ID;
  script.async = true;
  script.src = TAWK_SCRIPT_URL;
  script.charset = "UTF-8";
  script.setAttribute("crossorigin", "*");
  document.head.appendChild(script);
}

export function openTawkChat() {
  if (typeof window === "undefined") return;

  const api = (window.Tawk_API = window.Tawk_API || {});
  if (typeof api.maximize === "function") {
    api.maximize();
    return;
  }

  pendingOpen = true;
  if (!loadHandlerRegistered) {
    const previousOnLoad = api.onLoad;
    api.onLoad = () => {
      previousOnLoad?.();
      loadHandlerRegistered = false;
      if (pendingOpen) {
        pendingOpen = false;
        window.Tawk_API?.maximize?.();
      }
    };
    loadHandlerRegistered = true;
  }

  loadTawkWidget();
}
