/*
 * app.js - class-based frontend for chat UI
 * - APIClient: handles network calls (/api/polish, /api/messages)
 * - ChatUI: DOM rendering and UI helpers
 * - ChatApp: wires UI and API together and manages app logic
 */

// APIClient is provided by api-client.js (shared across the relevant pages)

class ChatUI {
  clearChat() {
    if (this.messagesList) {
      this.messagesList.innerHTML = "";
    }
    this.showEmptyState();
  }
  constructor(selectors = {}) {
    this.messagesList = document.getElementById(selectors.messagesId || "messages");
    this.messageForm = document.getElementById(selectors.formId || "messageForm");
    this.messageInput = document.getElementById(selectors.inputId || "messageInput");
    this.toneSelect = document.getElementById(selectors.toneId || "toneSelect");
    this.polishBtn = document.getElementById(selectors.polishId || "polishBtn");
    this.aiResponseArea = document.getElementById(selectors.aiAreaId || "aiResponseArea");
    this.aiResponse = document.getElementById(selectors.aiId || "aiResponse");
    this.sendAiBtn = document.getElementById(selectors.sendAiId || "sendAiBtn");
    this.discardAiBtn = document.getElementById(selectors.discardAiId || "discardAiBtn");
    this.emptyState = document.getElementById(selectors.emptyStateId || "emptyState");
  }

  renderMessage(text, cls = "user") {
    if (!this.messagesList) return;
    const li = document.createElement("li");
    li.className = `message ${cls}`;
    li.textContent = text;
    this.messagesList.appendChild(li);
    this.scrollToBottom();
    // hide empty state once a message has been added
    if (this.emptyState) this.emptyState.classList.add("hidden");
  }

  showEmptyState() {
    if (this.emptyState) this.emptyState.classList.remove("hidden");
  }
  hideEmptyState() {
    if (this.emptyState) this.emptyState.classList.add("hidden");
  }

  scrollToBottom() {
    if (!this.messagesList) return;
    const container = this.messagesList.parentElement || this.messagesList;
    container.scrollTop = container.scrollHeight;
  }

  showAIResponse(text) {
    if (!this.aiResponseArea || !this.aiResponse) return;
    this.aiResponse.value = text || "";
    this.aiResponseArea.classList.remove("hidden");
  }

  hideAIResponse() {
    if (!this.aiResponseArea || !this.aiResponse) return;
    this.aiResponseArea.classList.add("hidden");
    this.aiResponse.value = "";
  }

  setPolishLoading(loading = false) {
    if (!this.polishBtn) return;
    this.polishBtn.disabled = loading;
    this.polishBtn.textContent = loading ? "Polishing..." : "Polish";
  }

  clearInput() {
    if (this.messageInput) this.messageInput.value = "";
  }
}

class ChatApp {
  handleClearChat() {
    this.ui.clearChat();
  }
  constructor(apiClient, ui) {
    this.api = apiClient;
    this.ui = ui;
  }

  init() {
    if (this.ui.messageForm) {
      this.ui.messageForm.addEventListener("submit", (e) => this.onSubmit(e));
    }

    if (this.ui.polishBtn) {
      this.ui.polishBtn.addEventListener("click", () => this.onPolish());
    }

    if (this.ui.sendAiBtn) {
      this.ui.sendAiBtn.addEventListener("click", () => this.onSendAI());
    }

    if (this.ui.discardAiBtn) {
      this.ui.discardAiBtn.addEventListener("click", () => this.ui.hideAIResponse());
    }
  }

  async onSubmit(e) {
    e.preventDefault();
    const txt = ((this.ui.messageInput && this.ui.messageInput.value) || "").trim();
    if (!txt) return;
    const tone = (this.ui.toneSelect && this.ui.toneSelect.value) || "professional";
    this.ui.renderMessage(txt, "user"); // Always append user's message first
    this.ui.clearInput();
    // Send to backend for rewriting and display result
    try {
      const rewritten = await this.api.rewriteText(txt, tone);
      this.ui.renderMessage(rewritten, "ai");
    } catch (err) {
      this.ui.renderMessage("Error: Could not get response from AI.", "ai");
    }
  }

  async onPolish() {
    const txt = ((this.ui.messageInput && this.ui.messageInput.value) || "").trim();
    if (!txt) {
      if (this.ui.messageInput) this.ui.messageInput.focus();
      return;
    }
    const tone = (this.ui.toneSelect && this.ui.toneSelect.value) || "professional";
    this.ui.setPolishLoading(true);
    try {
      // Use rewriteText so selected tone is sent to backend
      const rewritten = await this.api.rewriteText(txt, tone);
      this.ui.showAIResponse(rewritten);
    } finally {
      this.ui.setPolishLoading(false);
    }
  }

  async onSendAI() {
    const txt = ((this.ui.aiResponse && this.ui.aiResponse.value) || "").trim();
    if (!txt) return;
    this.ui.renderMessage(txt, "ai");
    this.ui.hideAIResponse();
    // No saveMessage call needed
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Use API_BASE from config.js for correct backend port
  const apiBase = window.APP_CONFIG && window.APP_CONFIG.API_BASE ? window.APP_CONFIG.API_BASE : "";
  const api = new APIClient(apiBase);
  const ui = new ChatUI({
    messagesId: "messages",
    formId: "messageForm",
    inputId: "messageInput",
    toneId: "toneSelect",
    polishId: "polishBtn",
    aiAreaId: "aiResponseArea",
    aiId: "aiResponse",
    sendAiId: "sendAiBtn",
    discardAiId: "discardAiBtn",
  });
  const app = new ChatApp(api, ui);
  app.init();

  // Add clear chat button handler
  const clearChatBtn = document.getElementById("clearChatBtn");
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => app.handleClearChat());
  }

  // Default tone handling: load saved default tone and sync profile <-> composer
  const profileToneSelect = document.getElementById("profileToneSelect");
  const saveToneBtn = document.getElementById("saveToneBtn");
  const saveToneMsg = document.getElementById("saveToneMsg");

  function loadDefaultTone() {
    const saved = localStorage.getItem("default_tone") || "professional";
    if (ui.toneSelect) ui.toneSelect.value = saved;
    if (profileToneSelect) profileToneSelect.value = saved;
  }

  // Save selected tone from profile and sync to composer
  if (saveToneBtn && profileToneSelect) {
    saveToneBtn.addEventListener("click", () => {
      const val = profileToneSelect.value || "professional";
      localStorage.setItem("default_tone", val);
      if (ui.toneSelect) ui.toneSelect.value = val;
      if (saveToneMsg) {
        saveToneMsg.style.display = "inline";
        setTimeout(() => {
          saveToneMsg.style.display = "none";
        }, 1500);
      }
    });
  }

  // ensure tone is loaded initially
  loadDefaultTone();

  // show empty state when there are no messages
  if (ui.messagesList && ui.messagesList.children.length === 0) {
    ui.showEmptyState();
  } else {
    ui.hideEmptyState();
  }

  // Lightweight router for SPA views inside index.html
  function showView(name) {
    const views = ["view-chat", "view-dashboard", "view-profile"];
    views.forEach((v) => {
      const el = document.getElementById(v);
      if (!el) return;
      if (v === `view-${name}`) el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
    // highlight nav
    document.querySelectorAll(".topnav .nav-link").forEach((a) => {
      if (a.getAttribute("href") === `#/${name}`) a.classList.add("active");
      else a.classList.remove("active");
    });

    // when showing chat, reset composer to saved default tone
    if (name === "chat") {
      const saved = localStorage.getItem("default_tone") || "professional";
      if (ui.toneSelect) ui.toneSelect.value = saved;
    }

    // load dashboard items when view-dashboard
    if (name === "dashboard") {
      const convList = document.getElementById("conversationsList");
      if (convList && convList.children.length === 0) {
        api.listConversations().then((list) => {
          list.forEach((c) => {
            const li = document.createElement("li");
            li.className = "message system";
            li.innerHTML = `<strong>${c.title}</strong><div class='meta'>${c.last} · ${c.updated}</div>`;
            convList.appendChild(li);
          });
        });
      }
    }

    // when showing profile, populate the select from saved tone or current composer tone
    if (name === "profile") {
      const saved = localStorage.getItem("default_tone");
      if (profileToneSelect) {
        profileToneSelect.value = saved || (ui.toneSelect && ui.toneSelect.value) || "professional";
      }
    }
  }

  function router() {
    const hash = location.hash || "#/chat";
    const parts = hash.replace("#/", "").split("/");
    const view = parts[0] || "chat";
    // route guarding: require auth for protected views
    const protectedViews = ["chat", "dashboard", "profile"];
    const token = localStorage.getItem("auth_token");
    if (protectedViews.includes(view) && !token) {
      // redirect to login page
      window.location.href = "login.html";
      return;
    }
    showView(view);
  }

  window.addEventListener("hashchange", router);
  router();
  // When the tab/page becomes visible again, ensure composer uses saved default tone
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const saved = localStorage.getItem("default_tone") || "professional";
      if (ui.toneSelect) ui.toneSelect.value = saved;
    }
  });
  // Logout handler (profile view)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("auth_token");
      // go to login
      window.location.href = "/login.html";
    });
  }

  // Auth-aware nav: replace Login with Sign out when authenticated
  const authLink = document.querySelector(".auth-link");
  function updateAuthLink() {
    const token = localStorage.getItem("auth_token");
    if (!authLink) return;
    if (token) {
      authLink.textContent = "Sign out";
      authLink.href = "javascript:void(0)";
      authLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("auth_token");
        // refresh to login
        window.location.href = "login.html";
      });
    } else {
      authLink.textContent = "Login";
      authLink.href = "login.html";
    }
  }
  updateAuthLink();
});
