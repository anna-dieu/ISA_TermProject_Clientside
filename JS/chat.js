"use strict";

const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";

let selectedUserId = null;

async function loadUsers() {
  const token =
    (window.authClient && window.authClient.getToken && window.authClient.getToken()) ||
    localStorage.getItem("auth_token") ||
    null;

  try {
    const res = await fetch(`${apiBase}/api/User`, {
      headers: token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.warn(
          "Unauthorized fetching users (401). User may not be logged in or token expired."
        );
        // Optionally redirect to login page or show a message to the user
        // window.location.href = 'login.html';
      } else {
        console.warn("Failed to fetch users:", res.status);
      }
      return;
    }

    // Only parse JSON for OK responses to avoid "Unexpected end of JSON input"
    const users = await res.json();
    const list = document.getElementById("userList");
    list.innerHTML = "";

    // Determine current user's userName (if available) so we can skip listing ourselves
    const currentUserObj =
      (window.authClient && window.authClient.getUser && window.authClient.getUser()) || null;
    const currentUserName =
      currentUserObj &&
      (currentUserObj.userName || currentUserObj.username || currentUserObj.email);

    users.forEach((u) => {
      // Skip current user in the list
      if (currentUserName && u.userName === currentUserName) return;

      const li = document.createElement("li");
      li.textContent = u.userName;
      li.dataset.id = u.id;
      li.addEventListener("click", () => openChat(u));
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

function openChat(user) {
  selectedUserId = user.id;

  const chatArea = document.getElementById("chatArea");
  const chatTitle = document.getElementById("chatTitle");
  const sendButton = document.getElementById("sendButton");
  const messageInput = document.getElementById("messageInput");

  // Unhide the chat area if hidden
  chatArea.classList.remove("hidden");

  // Update title and clear messages
  chatTitle.textContent = `Chat with ${user.userName}`;
  document.getElementById("messagesList").innerHTML = "";
  loadConversation(user.id); // fetch and render messages

  // Enable input and send button
  messageInput.disabled = false;
  sendButton.disabled = false;

  console.log(`Chat opened with ${user.userName} (${user.id})`);
}

loadUsers();

// Create a connection to your SignalR Hub endpoint
const connection = new signalR.HubConnectionBuilder()
  .withUrl(`${apiBase}/chatHub`, {
    // Read token at request time. WebSocket/SSE transports must receive token via query string.
    accessTokenFactory: () => {
      const t =
        (window.authClient && window.authClient.getToken && window.authClient.getToken()) ||
        localStorage.getItem("auth_token") ||
        null;
      // Log presence (mask token for safety)
      if (t) console.log("SignalR access token present: ", `${t.slice(0, 8)}...${t.slice(-8)}`);
      else console.warn("SignalR access token missing");
      return t;
    },
  }) // or your deployed backend URL
  .withAutomaticReconnect()
  .build();

// When server calls 'ReceiveMessage', show it
connection.on("ReceiveMessage", (user, message) => {
  const msgList = document.getElementById("messagesList");
  const li = document.createElement("li");
  li.classList.add("message");

  // Determine if message was sent by current user (compare by name if id not available)
  const isMine = user === window.currentUserName;
  li.classList.add(isMine ? "sent" : "received");

  if (!isMine) {
    const nameDiv = document.createElement("div");
    nameDiv.classList.add("sender-name");
    nameDiv.textContent = user;
    li.appendChild(nameDiv);
  }

  const textDiv = document.createElement("div");
  textDiv.classList.add("message-text");
  textDiv.textContent = message;
  li.appendChild(textDiv);

  msgList.appendChild(li);
  msgList.scrollTop = msgList.scrollHeight;
});

// Load current user information (id and display name) so we can mark incoming messages
async function loadCurrentUser() {
  // Prefer already-stored user object
  let me = window.authClient && window.authClient.getUser && window.authClient.getUser();

  // If not available, try fetching from server via authClient.fetchUser()
  if (!me && window.authClient && window.authClient.fetchUser) {
    try {
      me = await window.authClient.fetchUser();
    } catch (e) {
      console.warn("Could not fetch current user:", e);
      me = null;
    }
  }

  if (me) {
    window.currentUserId = me.id || me.userId || null;
    window.currentUserName = me.userName || me.username || me.email || "You";
  } else {
    window.currentUserId = null;
    window.currentUserName = null;
  }
}

connection.on("ReceivePrivateMessage", (fromUserName, message, fromUserId) => {
  const msgList = document.getElementById("messagesList");
  const li = document.createElement("li");
  li.classList.add("message");

  // Prefer id comparison when available, fallback to name comparison
  const isMine =
    typeof fromUserId !== "undefined" && fromUserId !== null
      ? fromUserId === window.currentUserId
      : fromUserName === window.currentUserName;

  li.classList.add(isMine ? "sent" : "received");

  // Show sender label for received messages
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

// Load current user first, then start the SignalR connection so handlers can use current user info
loadCurrentUser()
  .catch((e) => console.warn("loadCurrentUser failed:", e))
  .then(() =>
    connection
      .start()
      .then(() => {
        console.log("Connected to SignalR hub");
        document.getElementById("sendButton").disabled = false;
      })
      .catch((err) => console.error("SignalR connection failed:", err))
  );

// Send message
document.getElementById("sendButton").addEventListener("click", () => {
  const message = document.getElementById("messageInput").value.trim();
  if (!selectedUserId) return alert("Select a user first");
  if (!message) return;

  connection
    .invoke("SendPrivateMessage", selectedUserId, message)
    .catch((err) => console.error("Send failed:", err));

  document.getElementById("messageInput").value = "";
});

async function loadConversation(receiverId) {
  const token =
    (window.authClient && (await window.authClient.getToken())) ||
    localStorage.getItem("auth_token") ||
    null;

  if (!token) {
    console.error("Missing auth token");
    return;
  }

  try {
    const res = await fetch(`${apiBase}/api/message/${receiverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Failed to fetch messages:", res.status);
      return;
    }

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
      nameDiv.textContent = isMine ? window.currentUserName : m.senderName || "Unknown";
      li.appendChild(nameDiv);

      const textDiv = document.createElement("div");
      textDiv.textContent = m.content;
      li.appendChild(textDiv);

      msgList.appendChild(li);
    });
    msgList.scrollTop = msgList.scrollHeight;
  } catch (err) {
    console.error("Error loading conversation:", err);
  }
}
