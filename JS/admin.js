/* global APIClient */

class AdminPage {
  constructor() {
    this.apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
    this.authClient = window.authClient || null; // may be available later
    this.api = window.api || null; // will create if missing

    // DOM elements (populated on init)
    this.tbody = null;
    this.messageArea = null;

    // Bind methods used as callbacks
    this.loadUsers = this.loadUsers.bind(this);
    this.renderUsers = this.renderUsers.bind(this);
    this.showMessage = this.showMessage.bind(this);
    this.escapeHtml = this.escapeHtml.bind(this);
    this.showCreateForm = this.showCreateForm.bind(this);
    this.hideCreateForm = this.hideCreateForm.bind(this);
    this.handleCreateUser = this.handleCreateUser.bind(this);
    this.editUser = this.editUser.bind(this);
    this.hideEditForm = this.hideEditForm.bind(this);
    this.handleUpdateUser = this.handleUpdateUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this.promoteUser = this.promoteUser.bind(this);
    this.demoteUser = this.demoteUser.bind(this);
    this.isAdminUser = this.isAdminUser.bind(this);
  }

  getTokenFallback() {
    if (this.authClient && this.authClient.getToken) return this.authClient.getToken();
    return localStorage.getItem("auth_token") || localStorage.getItem("ai_chat_token");
  }

  // Check admin by calling backend /api/user/me or falling back
  async isAdminUser() {
    // Prefer authClient token if present
    const token =
      (this.authClient && this.authClient.getToken && this.authClient.getToken()) ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("ai_chat_token");

    console.log("isAdminUser: Checking token...", token ? "Token found" : "No token");

    if (!token) return false;

    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const url = `${this.apiBase}/api/user/me`;
      console.log("isAdminUser: Fetching from", url);

      const response = await fetch(url, { method: "GET", headers });
      console.log("isAdminUser: Response status", response.status, response.statusText);

      if (response.ok) {
        const userData = await response.json();
        console.log("isAdminUser: Current user data received:", userData);

        const isAdmin = (userData.roles && userData.roles.includes("Admin")) || userData.isAdmin;

        // persist user data for backwards-compat
        try {
          localStorage.setItem("ai_chat_user", JSON.stringify(userData));
        } catch (e) {
          /* ignore */
        }

        return !!isAdmin;
      } else {
        const errorText = await response.text();
        console.error("isAdminUser: Failed to get user info:", response.status, errorText);

        if (response.status === 401 || response.status === 403) {
          // Try admin endpoint as fallback
          try {
            const adminResponse = await fetch(`${this.apiBase}/api/admin/AdminUsers`, {
              method: "GET",
              headers,
            });
            console.log("isAdminUser: Admin endpoint response:", adminResponse.status);
            if (adminResponse.ok) return true;
          } catch (e) {
            console.error("isAdminUser: Error checking admin endpoint:", e);
          }
        }
        return false;
      }
    } catch (error) {
      console.error("isAdminUser: Error checking admin status:", error);
      // fallback to stored user
      const userData = localStorage.getItem("ai_chat_user");
      if (userData) {
        try {
          const u = JSON.parse(userData);
          const email = u.email || u.userName || "";
          const isHardcoded =
            email === "admin@admin.com" || email === "aa@aa.aa" || email === "john@john.com";
          return isHardcoded;
        } catch (e) {
          console.error(e);
        }
      }
      return false;
    }
  }

  // Initialize instance: ensure apiClient, cache DOM nodes, and run admin check
  async init() {
    // Ensure authClient reference
    if (!this.authClient && window.authClient) this.authClient = window.authClient;

    // Ensure api client
    if (!this.api) {
      try {
        this.api = new APIClient(this.apiBase);
        window.api = this.api; // expose globally for other scripts
      } catch (e) {
        console.warn("AdminPage: Failed to construct APIClient:", e);
      }
    }

    // Cache DOM nodes
    this.tbody = document.getElementById("usersTableBody");
    this.messageArea = document.getElementById("messageArea");

    // Attach form handlers (if forms are present)
    const createForm = document.getElementById("createForm");
    if (createForm) createForm.addEventListener("submit", this.handleCreateUser);

    const editForm = document.getElementById("editForm");
    if (editForm) editForm.addEventListener("submit", this.handleUpdateUser);

    // Run admin check and show/hide sections accordingly
    const isAdmin = await this.isAdminUser();
    console.log("Admin check result:", isAdmin);

    const adminContent = document.getElementById("adminContent");
    const accessDenied = document.getElementById("accessDenied");

    if (isAdmin) {
      if (adminContent) adminContent.style.display = "block";
      if (accessDenied) accessDenied.style.display = "none";
      await this.loadUsers();
    } else {
      if (adminContent) adminContent.style.display = "none";
      if (accessDenied) accessDenied.style.display = "block";

      const token =
        (this.authClient && this.authClient.getToken && this.authClient.getToken()) ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("ai_chat_token");

      if (!token && accessDenied) {
        accessDenied.innerHTML = `
          <h2>Not Logged In</h2>
          <p>You must be logged in as an administrator to access this page.</p>
          <a href="login.html" class="btn btn-primary">Go to Login</a>
        `;
      } else if (accessDenied) {
        accessDenied.innerHTML = `
          <h2>Access Denied</h2>
          <p>You do not have administrator privileges. Only users with Admin role can access this page.</p>
          <a href="index.html" class="btn btn-primary">Go to Chat</a>
        `;
      }
    }
  }

  // Load users via API client and render
  async loadUsers() {
    if (!this.tbody) this.tbody = document.getElementById("usersTableBody");
    const tbody = this.tbody;
    try {
      if (!this.authClient) throw new Error("Authentication client not available");

      const token = this.getTokenFallback();

      if (!token) {
        tbody.innerHTML = `<tr>
          <td colspan="4" class="loading">Please log in to view users.</td>
        </tr>`;
        this.showMessage(
          "You must be logged in to view users. Please log in and try again.",
          "error"
        );
        return;
      }

      const users = await (this.api && this.api.getUsers ? this.api.getUsers() : []);
      this.renderUsers(users || []);
    } catch (error) {
      console.error("Error loading users:", error);
      const errorMsg = error.message || "Unknown error occurred";
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="loading">Error loading users: ' +
          this.escapeHtml(errorMsg) +
          "</td></tr>";
      }
      this.showMessage(`Error: ${errorMsg}`, "error");
    }
  }

  renderUsers(users) {
    if (!this.tbody) this.tbody = document.getElementById("usersTableBody");
    const tbody = this.tbody;
    if (!Array.isArray(users) || users.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="loading">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map((user) => {
        const roles = user.roles || [];
        const isAdmin = roles.includes("Admin");
        const roleDisplay = roles.length > 0 ? roles.join(", ") : "User";
        const roleBadgeClass = isAdmin ? "admin" : "user";

        const promoteBtn = !isAdmin
          ? `<button class="btn-small btn-promote" onclick="promoteUser('${user.id}')">Promote to Admin</button>`
          : "";

        const demoteBtn = isAdmin
          ? `<button class="btn-small btn-demote" onclick="demoteUser('${user.id}')">Demote to User</button>`
          : "";

        const editBtn = `<button class="btn-small btn-edit" onclick="editUser('${
          user.id
        }', '${this.escapeHtml(user.email)}', '${roleDisplay}')">Edit</button>`;

        const deleteBtn = `<button class="btn-small btn-delete" onclick="deleteUser('${
          user.id
        }', '${this.escapeHtml(user.email)}')">Delete</button>`;

        return `
          <tr>
            <td>${this.escapeHtml(user.email)}</td>
            <td>${this.escapeHtml(user.userName)}</td>
            <td>
              <span class="role-badge ${roleBadgeClass}">${this.escapeHtml(roleDisplay)}</span>
            </td>
            <td>
              <div class="btn-group">
                ${promoteBtn}${demoteBtn}${editBtn}${deleteBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showMessage(message, type = "success") {
    if (!this.messageArea) this.messageArea = document.getElementById("messageArea");
    const messageArea = this.messageArea;
    if (!messageArea) return;
    const className = type === "error" ? "error-message" : "success-message";
    messageArea.innerHTML = `<div class="${className}">${this.escapeHtml(message)}</div>`;
    setTimeout(() => {
      messageArea.innerHTML = "";
    }, 5000);
  }

  // Create user flow
  showCreateForm() {
    const el = document.getElementById("createUserForm");
    if (el) el.style.display = "block";
    this.hideEditForm();
  }

  hideCreateForm() {
    const el = document.getElementById("createUserForm");
    if (el) el.style.display = "none";
    const form = document.getElementById("createForm");
    if (form) form.reset();
  }

  async handleCreateUser(event) {
    event.preventDefault();
    const email = document.getElementById("createEmail").value;
    const password = document.getElementById("createPassword").value;
    const role = document.getElementById("createRole").value;

    try {
      if (!this.api || !this.api.createUser) throw new Error("API client not available");
      await this.api.createUser({ email, password, role });
      this.showMessage(`User ${email} created successfully!`, "success");
      this.hideCreateForm();
      this.loadUsers();
    } catch (error) {
      this.showMessage(`Error creating user: ${error.message}`, "error");
    }
  }

  // Edit user
  editUser(userId, email, currentRole) {
    const idEl = document.getElementById("editUserId");
    const emailEl = document.getElementById("editEmail");
    const roleEl = document.getElementById("editRole");

    if (idEl) idEl.value = userId;
    if (emailEl) emailEl.value = email;
    if (roleEl) roleEl.value = currentRole.includes("Admin") ? "Admin" : "User";

    const formEl = document.getElementById("editUserForm");
    if (formEl) formEl.classList.add("active");
    this.hideCreateForm();
    const editForm = document.getElementById("editUserForm");
    if (editForm) editForm.scrollIntoView({ behavior: "smooth" });
  }

  hideEditForm() {
    const form = document.getElementById("editUserForm");
    if (form) form.classList.remove("active");
    const editForm = document.getElementById("editForm");
    if (editForm) editForm.reset();
  }

  async handleUpdateUser(event) {
    event.preventDefault();
    const userId = document.getElementById("editUserId").value;
    const email = document.getElementById("editEmail").value;
    const role = document.getElementById("editRole").value;

    try {
      if (!this.api || !this.api.updateUser) throw new Error("API client not available");
      await this.api.updateUser(userId, { email, role });
      this.showMessage(`User updated successfully!`, "success");
      this.hideEditForm();
      this.loadUsers();
    } catch (error) {
      this.showMessage(`Error updating user: ${error.message}`, "error");
    }
  }

  // Delete
  async deleteUser(userId, email) {
    const ok = confirm(
      `Are you sure you want to delete user "${email}"? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      if (!this.api || !this.api.deleteUser) throw new Error("API client not available");
      await this.api.deleteUser(userId);
      this.showMessage(`User ${email} deleted successfully!`, "success");
      this.loadUsers();
    } catch (error) {
      this.showMessage(`Error deleting user: ${error.message}`, "error");
    }
  }

  // Promote / Demote
  async promoteUser(userId) {
    try {
      if (!this.api || !this.api.promoteToAdmin) throw new Error("API client not available");
      await this.api.promoteToAdmin(userId);
      this.showMessage("User promoted to Admin successfully!", "success");
      this.loadUsers();
    } catch (error) {
      this.showMessage(`Error promoting user: ${error.message}`, "error");
    }
  }

  async demoteUser(userId) {
    if (!confirm("Are you sure you want to demote this user from Admin to User?")) return;
    try {
      if (!this.api || !this.api.demoteToUser) throw new Error("API client not available");
      await this.api.demoteToUser(userId);
      this.showMessage("User demoted to User role successfully!", "success");
      this.loadUsers();
    } catch (error) {
      this.showMessage(`Error demoting user: ${error.message}`, "error");
    }
  }
}

// Initialize AdminPage on DOMContentLoaded and expose instance + backward-compatible globals
document.addEventListener("DOMContentLoaded", async () => {
  // Small delay to allow authClient and APIClient to load if they are loaded shortly after
  await new Promise((r) => setTimeout(r, 100));

  const adminPage = new AdminPage();
  // Try to pick up authClient if it became available
  if (!adminPage.authClient && window.authClient) adminPage.authClient = window.authClient;
  // If an APIClient is already present, use it
  if (!adminPage.api && window.api) adminPage.api = window.api;

  // Initialize (runs admin check and user load)
  await adminPage.init();

  // Expose instance
  window.admin = adminPage;

  // Backwards-compatible global functions (so inline onclicks keep working)
  window.isAdminUser = adminPage.isAdminUser;
  window.loadUsers = adminPage.loadUsers;
  window.renderUsers = adminPage.renderUsers;
  window.escapeHtml = adminPage.escapeHtml;
  window.showMessage = adminPage.showMessage;
  window.showCreateForm = adminPage.showCreateForm;
  window.hideCreateForm = adminPage.hideCreateForm;
  window.handleCreateUser = adminPage.handleCreateUser;
  window.editUser = adminPage.editUser;
  window.hideEditForm = adminPage.hideEditForm;
  window.handleUpdateUser = adminPage.handleUpdateUser;
  window.deleteUser = adminPage.deleteUser;
  window.promoteUser = adminPage.promoteUser;
  window.demoteUser = adminPage.demoteUser;
});
