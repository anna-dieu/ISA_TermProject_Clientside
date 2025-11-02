/* global APIClient */

class DashboardPage {
  constructor() {
    this.apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";
    this.authClient = window.authClient || null;
    this.api = window.api || null;
    this.conversationsList = document.getElementById("conversationsList");
    this.navAuth = document.querySelector(".auth-link");
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

      if (!this.api || !this.api.listConversations) return;

      const list = await this.api.listConversations();
      this.renderConversations(list || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }

  renderConversations(list) {
    if (!this.conversationsList) {
      this.conversationsList = document.getElementById("conversationsList");
    }
    if (!this.conversationsList) return;
    this.conversationsList.innerHTML = "";
    list.forEach((c) => {
      const li = document.createElement("li");
      li.className = "message system";
      li.innerHTML = `
        <strong>${this.escapeHtml(c.title)}</strong>
        <div class='meta'>${this.escapeHtml(c.last)} · ${this.escapeHtml(c.updated)}</div>
      `;
      this.conversationsList.appendChild(li);
    });
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
