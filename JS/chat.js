"use strict";

// CONFIG & INITIALIZATION
const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
const API_BASE_URL = apiBase;

//  CHAT CONTROLLER CLASS
/**
 * ChatController handles chat UI, SignalR connection and API calls used
 * by the chat pages. It centralizes event wiring and network interactions.
 */
class ChatController {
  /**
   * Create a ChatController instance and initialize functionality.
   */
  constructor() {
    this.selectedUserId = null;
    this.currentUserId = null;
    this.currentUserName = null;
    this.connection = null;
    this.initConnection();
    this.setupEventListeners();
    this.loadUsers();
    this.loadCurrentUser();
  }

  /**
   * Initialize the SignalR connection and register incoming message handlers.
   * Uses the token from `authClient` (or legacy localStorage) as access token.
   */
  initConnection() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiBase}/chatHub`, {
        transport: signalR.HttpTransportType.LongPolling,
        accessTokenFactory: () =>
          window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null,
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on("ReceivePrivateMessage", (fromUserName, message, fromUserId) =>
      this.onReceivePrivateMessage(fromUserName, message, fromUserId)
    );
  }

  /**
   * Retrieve the stored authentication token.
   * @returns {string|null} JWT bearer token or null when not available.
   */
  getToken() {
    return window.authClient?.getToken?.() || localStorage.getItem("auth_token") || null;
  }

  /**
   * Load the list of users from the backend and populate the user list UI.
   * Skips the currently logged-in user when rendering the list.
   * @returns {Promise<void>}
   */
  async loadUsers() {
    const token = this.getToken();

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

        li.addEventListener("click", () => this.openChat(u));
        list.appendChild(li);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  /**
   * Open a private chat with a selected user.
   * @param {{id:string,userName:string}} user - user object selected from the list
   */
  openChat(user) {
    this.selectedUserId = user.id;

    const chatArea = document.getElementById("chatArea");
    const chatTitle = document.getElementById("chatTitle");
    const messageInput = document.getElementById("messageInput");

    chatArea.classList.remove("hidden");
    chatTitle.textContent = `Chat with ${user.userName}`;

    document.getElementById("messagesList").innerHTML = "";
    this.loadConversation(user.id);

    messageInput.disabled = false;
    document.getElementById("sendButton").disabled = false;
  }

  /**
   * Load current authenticated user information and start the SignalR connection.
   * Stores the current user id/name in `window` for compatibility with other scripts.
   * @returns {Promise<void>}
   */
  async loadCurrentUser() {
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
      this.currentUserId = me.id || me.userId;
      this.currentUserName = me.userName || me.username || me.email;
      window.currentUserId = this.currentUserId;
      window.currentUserName = this.currentUserName;
    }

    // Start SignalR connection
    try {
      await this.connection.start();
      console.log("Connected to SignalR hub");
      document.getElementById("sendButton").disabled = false;
    } catch (err) {
      console.error("SignalR connection failed:", err);
    }
  }

  /**
   * Handler for receiving a private message from SignalR.
   * Renders the incoming message into the messages list.
   * @param {string} fromUserName - Display name of the sender
   * @param {string} message - Message text
   * @param {string|null} fromUserId - Sender user id (may be null)
   */
  onReceivePrivateMessage(fromUserName, message, fromUserId) {
    const msgList = document.getElementById("messagesList");
    const li = document.createElement("li");
    li.classList.add("message");

    const isMine =
      fromUserId != null
        ? fromUserId === this.currentUserId
        : fromUserName === this.currentUserName;
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
  }

  /**
   * Load conversation history for the selected receiver from the backend.
   * @param {string} receiverId - The id of the user to load conversation with
   * @returns {Promise<void>}
   */
  async loadConversation(receiverId) {
    const token = this.getToken();

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

      const isMine = m.senderId === this.currentUserId;
      li.classList.add(isMine ? "sent" : "received");

      const nameDiv = document.createElement("div");
      nameDiv.classList.add("sender-name");
      nameDiv.textContent = isMine ? this.currentUserName : m.senderName;
      li.appendChild(nameDiv);

      const textDiv = document.createElement("div");
      textDiv.classList.add("message-text");
      textDiv.textContent = m.content;
      li.appendChild(textDiv);

      msgList.appendChild(li);
    });

    msgList.scrollTop = msgList.scrollHeight;
  }

  /**
   * Send text to the rewrite API and return the rewritten text.
   * Also checks for the `X-Usage-Warning` header and shows a notification if present.
   * @param {string} text - The message text to be rewritten
   * @param {string} tone - Desired tone (e.g. 'professional')
   * @returns {Promise<string>} rewritten text
   */
  async polishMessage(text, tone) {
    const token = this.getToken();

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
      this.showUsageWarning(warningHeader);
    }

    if (!response.ok) {
      console.error("Rewrite error:", response.status);
      throw new Error(`Failed to polish message (${response.status})`);
    }

    const data = await response.json();
    return data.rewrittenText;
  }

  /**
   * Send a private message to the currently selected user via SignalR.
   * @param {string} text - The message text to send
   */
  sendMessage(text) {
    if (!this.selectedUserId) {
      alert("Select a user first");
      return;
    }
    if (!text.trim()) return;

    this.connection
      .invoke("SendPrivateMessage", this.selectedUserId, text)
      .catch((err) => console.error("Send failed:", err));
  }

  /**
   * Send a raw text message to the MCP Chat endpoint (server-side chat model)
   * and return the textual reply. Adds Authorization header when token exists.
   * @param {string} text - Raw text to send to MCP Chat
   * @returns {Promise<string>} reply text from the MCP service
   */
  async messageMcp(text) {
    const token = this.getToken();
    console.log("[messageMcp] token:", token);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    console.log("[messageMcp] request headers:", headers);

    const response = await fetch(`${apiBase}/Chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(text), // Backend expects raw string in JSON
    });

    // Check for usage warning header
    const warningHeader = response.headers.get("X-Usage-Warning");
    console.log("[messageMcp] All response headers:", Array.from(response.headers.entries()));
    console.log("[messageMcp] X-Usage-Warning header:", warningHeader);
    console.log("[messageMcp] response status:", response.status);

    if (response.status === 401) {
      console.warn("[messageMcp] Unauthorized (401) from /Chat - prompting login");
      try {
        const errText = await response.text();
        console.warn("[messageMcp] 401 body:", errText);
      } catch (e) {
        /* ignore */
      }
      alert("You are not authorized. Please log in to use the chat feature.");
      throw new Error("Unauthorized");
    }

    if (warningHeader) {
      console.log("[messageMcp] Showing warning:", warningHeader);
      this.showUsageWarning(warningHeader);
    }

    if (!response.ok) {
      throw new Error("MCP message failed");
    }

    return await response.text(); // backend returns text/plain
  }

  /**
   * Show a temporary usage warning notification in the UI.
   * @param {string} message - The message to display in the notification
   */
  showUsageWarning(message) {
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

  /**
   * Wire up DOM event listeners for chat UI controls (polish, send, MCP, etc.).
   * This method is safe to call multiple times; it checks elements exist before
   * attaching event handlers.
   */
  setupEventListeners() {
    const polishBtn = document.getElementById("polishBtn");
    const toneSelect = document.getElementById("toneSelect");
    const aiResponseArea = document.getElementById("aiResponseArea");
    const aiResponse = document.getElementById("aiResponse");
    const sendAiBtn = document.getElementById("sendAiBtn");
    const discardAiBtn = document.getElementById("discardAiBtn");
    const messageInputField = document.getElementById("messageInput");
    const mcpBtn = document.getElementById("mcpBtn");
    const sendButton = document.getElementById("sendButton");
    const sendPolishedBtn = document.getElementById("sendPolishedBtn");

    // Send message button
    if (sendButton) {
      sendButton.addEventListener("click", () => {
        const message = messageInputField.value.trim();
        this.sendMessage(message);
        messageInputField.value = "";
      });
    }

    // Polish button
    if (polishBtn) {
      polishBtn.addEventListener("click", async () => {
        const text = messageInputField.value.trim();
        if (!text) return;

        const tone = toneSelect.value;
        aiResponseArea.classList.remove("hidden");
        aiResponse.value = "Polishing...";

        try {
          const polished = await this.polishMessage(text, tone);
          aiResponse.value = polished;
        } catch {
          aiResponse.value = "Error polishing text.";
        }
      });
    }

    // Send AI Response
    if (sendAiBtn) {
      sendAiBtn.addEventListener("click", () => {
        const polishedText = aiResponse.value.trim();

        if (!polishedText) return;
        if (!this.selectedUserId) {
          alert("Select a user first.");
          return;
        }

        this.sendMessage(polishedText);
        aiResponseArea.classList.add("hidden");
        aiResponse.value = "";
        messageInputField.value = "";
      });
    }

    // Discard AI Response
    if (discardAiBtn) {
      discardAiBtn.addEventListener("click", () => {
        aiResponseArea.classList.add("hidden");
        aiResponse.value = "";
      });
    }

    // MCP button
    if (mcpBtn) {
      mcpBtn.addEventListener("click", async () => {
        const text = messageInputField.value.trim();
        if (!text) return;

        aiResponseArea.classList.remove("hidden");
        aiResponse.value = "Thinking (MCP)...";

        try {
          const reply = await this.messageMcp(text);
          aiResponse.value = reply;
        } catch (e) {
          console.error(e);
          aiResponse.value = "Error contacting MCP server.";
        }
      });
    }

    // Send Polished button
    if (sendPolishedBtn) {
      sendPolishedBtn.addEventListener("click", () => {
        const polishedText = aiResponse.value.trim();

        if (!polishedText) return;
        if (!this.selectedUserId) {
          alert("Select a user first.");
          return;
        }

        this.sendMessage(polishedText);
        aiResponseArea.classList.add("hidden");
        aiResponse.value = "";
        messageInputField.value = "";
      });
    } else {
      console.warn("sendPolishedBtn not present in DOM; polished send disabled.");
    }
  }
}

// Initialize chat controller on page load
let chatController;
document.addEventListener("DOMContentLoaded", () => {
  chatController = new ChatController();
});
