const TAWK_SCRIPT_ID = "tawk-to-live-chat";
const TAWK_SCRIPT_URL = "https://embed.tawk.to/6af83ac6f2b1b13c471c2aea/1k7cqb6u9";

interface TawkApi {
  maximize?: () => void;
  minimize?: () => void;
  showWidget?: () => void;
  hideWidget?: () => void;
  onLoad?: () => void;
  onChatMinimized?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let pendingOpen = false;
let loadHandlerRegistered = false;
let minimizeHandlerRegistered = false;
let shouldShowWidget = false;

function applyWidgetVisibility(api: TawkApi) {
  if (shouldShowWidget) {
    api.showWidget?.();
    return;
  }

  api.minimize?.();
  api.hideWidget?.();
}

function registerTawkHandlers(api: TawkApi) {
  if (!loadHandlerRegistered) {
    const previousOnLoad = api.onLoad;
    api.onLoad = () => {
      previousOnLoad?.();
      loadHandlerRegistered = false;
      applyWidgetVisibility(api);
      if (pendingOpen) {
        pendingOpen = false;
        api.showWidget?.();
        api.maximize?.();
      }
    };
    loadHandlerRegistered = true;
  }

  if (!minimizeHandlerRegistered) {
    const previousOnChatMinimized = api.onChatMinimized;
    api.onChatMinimized = () => {
      previousOnChatMinimized?.();
      if (!shouldShowWidget) api.hideWidget?.();
    };
    minimizeHandlerRegistered = true;
  }
}

export function setTawkWidgetVisible(visible: boolean) {
  shouldShowWidget = visible;
  if (typeof window === "undefined") return;

  const api = (window.Tawk_API = window.Tawk_API || {});
  registerTawkHandlers(api);
  applyWidgetVisibility(api);
}

export function loadTawkWidget() {
  if (typeof window === "undefined") return;

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();
  registerTawkHandlers(window.Tawk_API);

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
  registerTawkHandlers(api);
  api.showWidget?.();
  if (typeof api.maximize === "function") {
    api.maximize();
    return;
  }

  pendingOpen = true;
  loadTawkWidget();
}
