// TuneSoar Bridge — Background Service Worker
// Pipes active tab URL to TuneSoar desktop app via WebSocket on localhost:47821

const WS_URL = "ws://localhost:47821";
let ws = null;
let authToken = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// Get auth token from storage
async function loadToken() {
  const result = await chrome.storage.local.get("tunesoar_auth_token");
  authToken = result.tunesoar_auth_token || "";
  return authToken;
}

// Save auth token
async function saveToken(token) {
  authToken = token;
  await chrome.storage.local.set({ tunesoar_auth_token: token });
}

// Connect to TuneSoar desktop WebSocket
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.debug("[TuneSoar] WebSocket connection failed, retrying...");
    scheduleReconnect();
    return;
  }

  ws.onopen = async () => {
    console.log("[TuneSoar] Connected to desktop app");
    reconnectAttempts = 0;

    // Authenticate
    if (authToken) {
      ws.send(authToken);
    }

    // Send current tab URL immediately
    sendCurrentTab();
  };

  ws.onmessage = (event) => {
    const msg = event.data;
    console.debug("[TuneSoar] Message:", msg);

    if (msg === "AUTH_OK") {
      console.log("[TuneSoar] Authenticated successfully");
      return;
    }

    if (msg.startsWith("ERROR:")) {
      console.warn("[TuneSoar] Server error:", msg);
    }
  };

  ws.onclose = () => {
    console.log("[TuneSoar] Disconnected");
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.debug("[TuneSoar] Connection error (desktop app may not be running)");
    ws = null;
    scheduleReconnect();
  };
}

// Schedule reconnect with exponential backoff
function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(connect, delay);
}

// Get current active tab URL
async function getCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("about:")) {
      return tab.url;
    }
  } catch (e) {
    console.debug("[TuneSoar] Could not get tab URL:", e);
  }
  return null;
}

// Send current tab URL to desktop
async function sendCurrentTab() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const url = await getCurrentTabUrl();
  if (url) {
    ws.send(`URL:${url}`);
  }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  sendCurrentTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    sendCurrentTab();
  }
});

// Listen for navigation within tabs
chrome.webNavigation?.onCommitted?.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    sendCurrentTab();
  }
});

// Initialize
async function init() {
  await loadToken();
  connect();

  // Heartbeat every 5 seconds
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("PING");
    } else {
      connect();
    }
  }, 5000);
}

init();

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_TOKEN") {
    saveToken(message.token).then(() => {
      connect();
      sendResponse({ success: true });
    });
    return true; // Async response
  }
  if (message.type === "GET_STATUS") {
    sendResponse({
      connected: ws !== null && ws.readyState === WebSocket.OPEN,
      token: authToken,
    });
    return true;
  }
  if (message.type === "RECONNECT") {
    if (ws) {
      ws.close();
      ws = null;
    }
    reconnectAttempts = 0;
    connect();
    sendResponse({ success: true });
    return true;
  }
});
