"use strict";

/* ============================================================
   CONFIG
============================================================ */
const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";

const API_BASE_URL = apiBase;

/* ============================================================
   GLOBAL STATE
============================================================ */
let selectedUserId = null;

/* ============================================================
   LOAD USER LIST
============================================================ */
async function loadUsers() {
  const token = window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null;

  try {
    const res = await fetch(`${apiBase}/api/User`, {
      headers: token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.warn("Failed to fetch users:", res.status);
      return;
    }

    const users = await res.json();
    const list = document.getElementById("userList");
    list.innerHTML = "";

    // Get current logged-in user
    const me = window.authClient?.getUser?.() || null;
    const currentUserName = me?.userName || me?.username || me?.email;

    // Populate other users
    for (const u of users) {
      if (currentUserName && u.userName === currentUserName) continue;

      const li = document.createElement("li");
      li.className = "user-item";
      li.dataset.id = u.id;

      // Create status indicator
      const statusDiv = document.createElement("div");
      statusDiv.className = "user-status online"; // Always show online for now

      // Create user info container
      const infoDiv = document.createElement("div");
      infoDiv.className = "user-info";

      // User name
      const nameDiv = document.createElement("div");
      nameDiv.className = "user-name";
      nameDiv.textContent = u.userName;

      // Chat preview (last message) - fetch it
      const previewDiv = document.createElement("div");
      previewDiv.className = "user-preview";
      previewDiv.textContent = "No messages yet";

      // Fetch last message for this user
      try {
        const msgRes = await fetch(`${apiBase}/api/message/${u.id}`, {
          headers: token
            ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
            : { "Content-Type": "application/json" },
        });

        if (msgRes.ok) {
          const messages = await msgRes.json();
          if (Array.isArray(messages) && messages.length > 0) {
            // Get the most recent message
            const lastMsg = messages[messages.length - 1];
            let preview = lastMsg.text || lastMsg.content || "No messages yet";
            // Truncate if too long
            if (preview.length > 50) {
              preview = preview.substring(0, 50) + "...";
            }
            previewDiv.textContent = preview;
          }
        }
      } catch (err) {
        console.warn("Could not fetch messages for user:", u.userName, err);
      }

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(previewDiv);

      // Create timestamp
      const timeDiv = document.createElement("div");
      timeDiv.className = "user-time";
      timeDiv.textContent = ""; // Empty for now

      li.appendChild(statusDiv);
      li.appendChild(infoDiv);
      li.appendChild(timeDiv);

      li.addEventListener("click", () => openChat(u));
      list.appendChild(li);
    }
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

// Load users on startup
loadUsers();

/* ============================================================
   OPEN CHAT WITH SELECTED USER
============================================================ */
function openChat(user) {
  selectedUserId = user.id;

  const chatArea = document.getElementById("chatArea");
  const chatTitle = document.getElementById("chatTitle");
  const sendButton = document.getElementById("sendButton");
  const messageInput = document.getElementById("messageInput");
  const mcpBtn = document.getElementById("mcpBtn");
  const sendPolishedBtn = document.getElementById("sendPolishedBtn");

  chatArea.classList.remove("hidden");
  chatTitle.textContent = `Chat with ${user.userName}`;

  document.getElementById("messagesList").innerHTML = "";
  loadConversation(user.id);

  messageInput.disabled = false;
  sendButton.disabled = false;
}

/* ============================================================
   SIGNALR SETUP
============================================================ */
// const connection = new signalR.HubConnectionBuilder()
//   .withUrl(`${apiBase}/chatHub`, {
//     accessTokenFactory: () =>
//       window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null,
//   })
//   .withAutomaticReconnect()
//   .build();

const connection = new signalR.HubConnectionBuilder()
  .withUrl(`${apiBase}/chatHub`, {
    transport: signalR.HttpTransportType.LongPolling,
    accessTokenFactory: () =>
      window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null,
  })
  .withAutomaticReconnect()
  .build();

/* ============================================================
   RECEIVE PRIVATE MESSAGE
============================================================ */
connection.on("ReceivePrivateMessage", (fromUserName, message, fromUserId) => {
  const msgList = document.getElementById("messagesList");
  const li = document.createElement("li");
  li.classList.add("message");

  const isMine =
    fromUserId != null
      ? fromUserId === window.currentUserId
      : fromUserName === window.currentUserName;

  li.classList.add(isMine ? "sent" : "received");

  if (!isMine) {
    const nameDiv = document.createElement("div");
    nameDiv.classList.add("sender-name");
    nameDiv.textContent = fromUserName;
    li.appendChild(nameDiv);
  }

  const textDiv = document.createElement("div");
  textDiv.classList.add("message-text");
  textDiv.textContent = message;
  li.appendChild(textDiv);

  msgList.appendChild(li);
  msgList.scrollTop = msgList.scrollHeight;
});

/* ============================================================
   LOAD CURRENT USER
============================================================ */
async function loadCurrentUser() {
  let me = window.authClient?.getUser?.();

  if (!me && window.authClient?.fetchUser) {
    try {
      me = await window.authClient.fetchUser();
    } catch (e) {
      console.warn("Could not fetch current user:", e);
      me = null;
    }
  }

  if (me) {
    window.currentUserId = me.id || me.userId;
    window.currentUserName = me.userName || me.username || me.email;
  }
}

loadCurrentUser().then(() =>
  connection
    .start()
    .then(() => {
      console.log("Connected to SignalR hub");
      document.getElementById("sendButton").disabled = false;
    })
    .catch((err) => console.error("SignalR connection failed:", err))
);

/* ============================================================
   SEND MESSAGE (BLUE SEND BUTTON)
============================================================ */
document.getElementById("sendButton").addEventListener("click", () => {
  const message = document.getElementById("messageInput").value.trim();
  if (!selectedUserId) return alert("Select a user first");
  if (!message) return;

  connection
    .invoke("SendPrivateMessage", selectedUserId, message)
    .catch((err) => console.error("Send failed:", err));

  document.getElementById("messageInput").value = "";
});

/* ============================================================
   LOAD CONVERSATION HISTORY
============================================================ */
async function loadConversation(receiverId) {
  const token = window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null;

  const res = await fetch(`${apiBase}/api/message/${receiverId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return;

  const messages = await res.json();
  const msgList = document.getElementById("messagesList");
  msgList.innerHTML = "";

  messages.forEach((m) => {
    const li = document.createElement("li");
    li.classList.add("message");

    const isMine = m.senderId === window.currentUserId;
    li.classList.add(isMine ? "sent" : "received");

    const nameDiv = document.createElement("div");
    nameDiv.classList.add("sender-name");
    nameDiv.textContent = isMine ? window.currentUserName : m.senderName;
    li.appendChild(nameDiv);

    const textDiv = document.createElement("div");
    textDiv.classList.add("message-text");
    textDiv.textContent = m.content;
    li.appendChild(textDiv);

    msgList.appendChild(li);
  });

  msgList.scrollTop = msgList.scrollHeight;
}

/* ============================================================
   POLISH FEATURE (MCP Rewrite API)
============================================================ */

// UI elements
const polishBtn = document.getElementById("polishBtn");
const toneSelect = document.getElementById("toneSelect");
const aiResponseArea = document.getElementById("aiResponseArea");
const aiResponse = document.getElementById("aiResponse");
const sendAiBtn = document.getElementById("sendAiBtn");
const discardAiBtn = document.getElementById("discardAiBtn");
const messageInputField = document.getElementById("messageInput");

// API call wrapper
async function polishMessage(text, tone) {
  const token = window.authClient?.getToken?.() || localStorage.getItem("auth_token");

  const response = await fetch(`${apiBase}/api/OpenAi/rewrite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userText: text, tone }),
  });

  // Check for usage warning header
  const warningHeader = response.headers.get("X-Usage-Warning");
  console.log("[polishMessage] All response headers:", Array.from(response.headers.entries()));
  console.log("[polishMessage] X-Usage-Warning header:", warningHeader);
  if (warningHeader) {
    console.log("[polishMessage] Showing warning:", warningHeader);
    showUsageWarning(warningHeader);
  }

  if (!response.ok) {
    console.error("Rewrite error:", response.status);
    throw new Error(`Failed to polish message (${response.status})`);
  }

  const data = await response.json();
  return data.rewrittenText;
}

// Polish button
polishBtn.addEventListener("click", async () => {
  const text = messageInputField.value.trim();
  if (!text) return;

  const tone = toneSelect.value;

  aiResponseArea.classList.remove("hidden");
  aiResponse.value = "Polishing...";

  try {
    const polished = await polishMessage(text, tone);
    aiResponse.value = polished;
  } catch {
    aiResponse.value = "Error polishing text.";
  }
});

// Send AI Response
sendAiBtn.addEventListener("click", () => {
  const polishedText = aiResponse.value.trim();

  if (!polishedText) return;
  if (!selectedUserId) return alert("Select a user first.");

  connection
    .invoke("SendPrivateMessage", selectedUserId, polishedText)
    .catch((err) => console.error("AI Send failed:", err));

  aiResponseArea.classList.add("hidden");
  aiResponse.value = "";
  messageInputField.value = "";
});

// Discard AI Response
discardAiBtn.addEventListener("click", () => {
  aiResponseArea.classList.add("hidden");
  aiResponse.value = "";
});

async function messageMcp(text) {
  const token = window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${apiBase}/Chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(text), // Backend expects raw string in JSON
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(text),   // Backend expects raw string in JSON
  });

  // Check for usage warning header
  const warningHeader = response.headers.get("X-Usage-Warning");
  console.log("[messageMcp] All response headers:", Array.from(response.headers.entries()));
  console.log("[messageMcp] X-Usage-Warning header:", warningHeader);
  if (warningHeader) {
    console.log("[messageMcp] Showing warning:", warningHeader);
    showUsageWarning(warningHeader);
  }

  if (!response.ok) {
    throw new Error("MCP message failed");
  }

  return await response.text(); // backend returns text/plain
}

function showUsageWarning(message) {
  // Create notification if it doesn't exist
  let notification = document.getElementById("usageWarningNotification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "usageWarningNotification";
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff9800;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 400px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    document.body.appendChild(notification);
  }

  notification.innerHTML = `
    <span>⚠️</span>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; font-size: 18px;">✕</button>
  `;

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (notification && notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

mcpBtn.addEventListener("click", async () => {
  const text = messageInputField.value.trim();
  if (!text) return;

  aiResponseArea.classList.remove("hidden");
  aiResponse.value = "Thinking (MCP)...";

  try {
    const reply = await messageMcp(text);
    aiResponse.value = reply;
  } catch (e) {
    console.error(e);
    aiResponse.value = "Error contacting MCP server.";
  }
});

sendPolishedBtn.addEventListener("click", () => {
  const polishedText = aiResponse.value.trim();

  if (!polishedText) return;
  if (!selectedUserId) return alert("Select a user first.");

  // Send polished text to private chat
  connection
    .invoke("SendPrivateMessage", selectedUserId, polishedText)
    .catch((err) => console.error("Polished Send failed:", err));

  // Hide AI area + clear
  aiResponseArea.classList.add("hidden");
  aiResponse.value = "";
  messageInputField.value = "";
});
