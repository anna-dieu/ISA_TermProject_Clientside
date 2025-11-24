/* global APIClient */

/**
 * ConversationItem - Represents a single conversation/user in the dashboard
 */
class ConversationItem {
  constructor(user, lastMessage = "", lastUpdated = "") {
    this.user = user;
    this.lastMessage = lastMessage || "No messages yet";
    this.lastUpdated = lastUpdated || "now";
  }

  render() {
    const li = document.createElement("li");
    li.className = "conversation-item";
    li.dataset.userId = this.user.id;
    
    // User info container
    const infoDiv = document.createElement("div");
    infoDiv.className = "conversation-info";
    
    // User name
    const nameDiv = document.createElement("div");
    nameDiv.className = "conversation-name";
    nameDiv.textContent = this.user.userName || this.user.email || "Unknown";
    
    // Last message preview
    const previewDiv = document.createElement("div");
    previewDiv.className = "conversation-preview";
    previewDiv.textContent = this.lastMessage;
    
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(previewDiv);
    
    // Timestamp (clickable to open chat)
    const timeDiv = document.createElement("div");
    timeDiv.className = "conversation-time conversation-link";
    timeDiv.textContent = "go to chat";
    timeDiv.style.cursor = "pointer";
    timeDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openChat();
    });
    
    li.appendChild(infoDiv);
    li.appendChild(timeDiv);
    
    // Make entire item clickable to open chat
    li.addEventListener("click", () => {
      this.openChat();
    });
    
    return li;
  }

  openChat() {
    // Redirect to chat page with the selected user
    window.location.href = `./chat.html?userId=${this.user.id}&userName=${encodeURIComponent(this.user.userName || this.user.email)}`;
  }
}

/**
 * DashboardPage - Main dashboard controller
 */
class DashboardPage {
  constructor() {
    this.apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";
    this.authClient = window.authClient || null;
    this.api = window.api || null;
    this.conversationsList = document.getElementById("conversationsList");
    this.navAuth = document.querySelector(".auth-link");
    this.conversations = [];
  }

  getToken() {
    if (this.authClient && this.authClient.getToken) return this.authClient.getToken();
    return localStorage.getItem("auth_token") || localStorage.getItem("ai_chat_token");
  }

  routeGuard() {
    const token = this.getToken();
    if (!token) {
      window.location.href = "/login.html";
      return false;
    }
    return true;
  }

  initNavAuth() {
    if (!this.navAuth) return;

    const token = this.getToken();
    if (token) {
      this.navAuth.textContent = "Sign out";
      this.navAuth.href = "javascript:void(0)";
      this.navAuth.addEventListener("click", (e) => {
        e.preventDefault();
        // Prefer authClient logout when available
        if (this.authClient && this.authClient.logout) {
          this.authClient.logout();
        } else {
          localStorage.removeItem("auth_token");
          window.location.href = "/login.html";
        }
      });
    } else {
      this.navAuth.textContent = "Login";
      this.navAuth.href = "/login.html";
    }
  }

  async loadConversations() {
    try {
      // Ensure API client
      if (!this.api && typeof APIClient !== "undefined") {
        this.api = new APIClient(this.apiBase);
        window.api = this.api;
      }

      if (!this.api) return;

      // Fetch users from the correct endpoint
      let users = [];
      try {
        const token = this.getToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(`${this.apiBase}/api/User`, {
          method: "GET",
          headers,
        });
        
        if (res.ok) {
          users = await res.json();
          console.log("Fetched users:", users);
        } else {
          console.warn("Failed to fetch users:", res.status);
        }
      } catch (err) {
        console.error("Could not fetch users:", err);
      }

      // Get current user
      const me = this.authClient?.getUser?.() || null;
      const currentUserName = me?.userName || me?.username || me?.email;

      // Filter out current user and create conversation items
      this.conversations = await Promise.all(
        users
          .filter(u => currentUserName && u.userName !== currentUserName)
          .map(async (u) => {
            let lastMessage = "No messages yet";
            try {
              // Fetch last message for this user
              const token = this.getToken();
              const headers = { "Content-Type": "application/json" };
              if (token) headers["Authorization"] = `Bearer ${token}`;
              
              const msgRes = await fetch(`${this.apiBase}/api/message/${u.id}`, {
                method: "GET",
                headers,
              });
              
              if (msgRes.ok) {
                const messages = await msgRes.json();
                if (Array.isArray(messages) && messages.length > 0) {
                  // Get the most recent message
                  const lastMsg = messages[messages.length - 1];
                  lastMessage = lastMsg.text || lastMsg.content || "No messages yet";
                  // Truncate if too long
                  if (lastMessage.length > 50) {
                    lastMessage = lastMessage.substring(0, 50) + "...";
                  }
                }
              }
            } catch (err) {
              console.warn("Could not fetch messages for user:", u.userName, err);
            }
            
            return new ConversationItem(u, lastMessage, "now");
          })
      );

      this.renderConversations();
    } catch (err) {
      console.error("Failed to load conversations:", err);
      this.renderNoConversations();
    }
  }

  renderConversations() {
    if (!this.conversationsList) {
      this.conversationsList = document.getElementById("conversationsList");
    }
    if (!this.conversationsList) return;
    
    this.conversationsList.innerHTML = "";

    if (this.conversations.length === 0) {
      this.renderNoConversations();
      return;
    }

    this.conversations.forEach(conv => {
      const li = conv.render();
      this.conversationsList.appendChild(li);
    });
  }

  renderNoConversations() {
    if (!this.conversationsList) return;
    
    this.conversationsList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "no-conversations";
    li.innerHTML = `
      <div class="no-messages-icon">💬</div>
      <div class="no-messages-text">No messages found</div>
    `;
    this.conversationsList.appendChild(li);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async init() {
    // pick up globals if they became available
    if (!this.authClient && window.authClient) this.authClient = window.authClient;
    if (!this.api && window.api) this.api = window.api;

    if (!this.routeGuard()) return;
    this.initNavAuth();
    await this.loadConversations();
  }
}

// Instantiate and expose
document.addEventListener("DOMContentLoaded", async () => {
  const page = new DashboardPage();
  window.dashboard = page;
  // initialize (do not block)
  page.init();
  // Backwards-compatible global
  window.loadConversations = () => page.loadConversations();
});
