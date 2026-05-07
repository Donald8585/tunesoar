// TuneSoar Bridge — Popup UI logic

const statusDiv = document.getElementById("status");
const dotDiv = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("saveBtn");
const reconnectBtn = document.getElementById("reconnectBtn");
const successDiv = document.getElementById("success");

function updateStatus(connected) {
  if (connected) {
    statusDiv.className = "status connected";
    dotDiv.className = "dot connected";
    statusText.textContent = "Connected to TuneSoar desktop";
  } else {
    statusDiv.className = "status disconnected";
    dotDiv.className = "dot disconnected";
    statusText.textContent = "Not connected — is TuneSoar running?";
  }
}

// Load current token and check status
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
  if (response) {
    updateStatus(response.connected);
    if (response.token) {
      tokenInput.value = response.token;
    }
  }
});

// Save token
saveBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) return;

  chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, (response) => {
    if (response?.success) {
      successDiv.classList.add("show");
      setTimeout(() => successDiv.classList.remove("show"), 2000);
    }
  });
});

// Reconnect
reconnectBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RECONNECT" }, (response) => {
    if (response?.success) {
      updateStatus(false);
    }
  });
});

// Poll status every 3 seconds
setInterval(() => {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (response) {
      updateStatus(response.connected);
    }
  });
}, 3000);
