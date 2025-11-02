// Check if user is admin by verifying with backend API
async function isAdminUser() {
  // Check if user has token
  const token = localStorage.getItem("auth_token") || localStorage.getItem("ai_chat_token");
  console.log("isAdminUser: Checking token...", token ? "Token found" : "No token");

  if (!token) {
    console.log("isAdminUser: No token found");
    return false;
  }

  try {
    // Try to get current user info from backend
    const headers = { "Content-Type": "application/json" };
    headers["Authorization"] = `Bearer ${token}`;

    const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
    const url = `${apiBase}/api/user/me`;
    console.log("isAdminUser: Fetching from", url);

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    console.log("isAdminUser: Response status", response.status, response.statusText);

    if (response.ok) {
      const userData = await response.json();
      console.log("isAdminUser: Current user data received:", userData);
      console.log("isAdminUser: User roles:", userData.roles);

      // Check if user has Admin role
      const isAdmin = userData.roles && userData.roles.includes("Admin");
      console.log("isAdminUser: Is admin?", isAdmin);

      // Store user data with roles
      if (userData) {
        localStorage.setItem("ai_chat_user", JSON.stringify(userData));
      }

      return isAdmin;
    } else {
      // Try to get error details
      const errorText = await response.text();
      console.error("isAdminUser: Failed to get user info:", response.status, errorText);

      // If 401 or 403, try alternative check - maybe try to access admin endpoint
      if (response.status === 401 || response.status === 403) {
        console.log("isAdminUser: Got 401/403, trying admin endpoint as fallback...");
        // Try to access admin users endpoint - if it works, user is admin
        try {
          const adminResponse = await fetch(`${apiBase}/api/admin/AdminUsers`, {
            method: "GET",
            headers,
          });
          console.log("isAdminUser: Admin endpoint response:", adminResponse.status);
          if (adminResponse.ok || adminResponse.status === 200) {
            return true;
          }
        } catch (e) {
          console.error("isAdminUser: Error checking admin endpoint:", e);
        }
      }
      return false;
    }
  } catch (error) {
    console.error("isAdminUser: Error checking admin status:", error);
    // Fallback: check stored user data for admin email (backward compatibility)
    const userData = localStorage.getItem("ai_chat_user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        const email = user.email || user.userName || "";
        console.log("isAdminUser: Fallback check for email:", email);
        // Fallback to hardcoded check if API fails
        const isHardcodedAdmin =
          email === "admin@admin.com" || email === "aa@aa.aa" || email === "john@john.com";
        console.log("isAdminUser: Hardcoded check result:", isHardcodedAdmin);
        return isHardcodedAdmin;
      } catch (e) {
        console.error("isAdminUser: Error parsing user data:", e);
      }
    }
    return false;
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Wait a bit for scripts to load
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check for token first
  const token = localStorage.getItem("auth_token") || localStorage.getItem("ai_chat_token");
  console.log("Token check:", {
    auth_token: localStorage.getItem("auth_token") ? "found" : "missing",
    ai_chat_token: localStorage.getItem("ai_chat_token") ? "found" : "missing",
    authClient: window.authClient ? "exists" : "missing",
    tokenFromAuthClient: window.authClient?.getToken?.() ? "found" : "missing",
  });

  // Initialize API client after DOM is loaded and scripts are available
  const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
  window.api = new APIClient(apiBase);

  // Check admin status (this is now async)
  const isAdmin = await isAdminUser();
  console.log("Admin check result:", isAdmin);

  if (isAdmin) {
    // Show admin content
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("accessDenied").style.display = "none";
    // Load users
    loadUsers();
  } else {
    // Show access denied
    document.getElementById("adminContent").style.display = "none";
    document.getElementById("accessDenied").style.display = "block";

    // If no token, suggest login
    if (!token) {
      document.getElementById("accessDenied").innerHTML = `
                        <h2>Not Logged In</h2>
                        <p>You must be logged in as an administrator to access this page.</p>
                        <a href="login.html" class="btn btn-primary">Go to Login</a>
                    `;
    } else {
      document.getElementById("accessDenied").innerHTML = `
                        <h2>Access Denied</h2>
                        <p>You do not have administrator privileges. Only users with Admin role can access this page.</p>
                        <a href="index.html" class="btn btn-primary">Go to Chat</a>
                    `;
    }
  }
});

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  try {
    // Ensure authClient is initialized
    if (!window.authClient) {
      console.error("authClient not initialized");
      throw new Error("Authentication client not available");
    }

    // Get token directly from localStorage as fallback
    const token =
      window.authClient.getToken() ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("ai_chat_token");

    if (!token) {
      console.error("No authentication token found");
      tbody.innerHTML = `<tr><td colspan="4" class="loading">Please log in to view users.</td></tr>`;
      showMessage("You must be logged in to view users. Please log in and try again.", "error");
      return;
    }

    console.log("Loading users with token:", token ? "Token found" : "No token");

    const users = await window.api.getUsers();
    console.log("Users loaded:", users);
    renderUsers(users);
  } catch (error) {
    console.error("Error loading users:", error);
    const errorMsg = error.message || "Unknown error occurred";
    tbody.innerHTML = `<tr><td colspan="4" class="loading">Error loading users: ${escapeHtml(
      errorMsg
    )}</td></tr>`;
    showMessage(`Error: ${errorMsg}`, "error");
  }
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const roles = user.roles || [];
      const isAdmin = roles.includes("Admin");
      const roleDisplay = roles.length > 0 ? roles.join(", ") : "User";
      const roleBadgeClass = isAdmin ? "admin" : "user";

      return `
                    <tr>
                        <td>${escapeHtml(user.email)}</td>
                        <td>${escapeHtml(user.userName)}</td>
                        <td>
                            <span class="role-badge ${roleBadgeClass}">${escapeHtml(
        roleDisplay
      )}</span>
                        </td>
                        <td>
                            <div class="btn-group">
                                ${
                                  !isAdmin
                                    ? `<button class="btn-small btn-promote" onclick="promoteUser('${user.id}')">Promote to Admin</button>`
                                    : ""
                                }
                                ${
                                  isAdmin
                                    ? `<button class="btn-small btn-demote" onclick="demoteUser('${user.id}')">Demote to User</button>`
                                    : ""
                                }
                                <button class="btn-small btn-edit" onclick="editUser('${
                                  user.id
                                }', '${escapeHtml(user.email)}', '${roleDisplay}')">Edit</button>
                                <button class="btn-small btn-delete" onclick="deleteUser('${
                                  user.id
                                }', '${escapeHtml(user.email)}')">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
    })
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(message, type = "success") {
  const messageArea = document.getElementById("messageArea");
  const className = type === "error" ? "error-message" : "success-message";
  messageArea.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
  setTimeout(() => {
    messageArea.innerHTML = "";
  }, 5000);
}

// Create User Functions
function showCreateForm() {
  document.getElementById("createUserForm").style.display = "block";
  hideEditForm();
}

function hideCreateForm() {
  document.getElementById("createUserForm").style.display = "none";
  document.getElementById("createForm").reset();
}

async function handleCreateUser(event) {
  event.preventDefault();
  const email = document.getElementById("createEmail").value;
  const password = document.getElementById("createPassword").value;
  const role = document.getElementById("createRole").value;

  try {
    await window.api.createUser({ email, password, role });
    showMessage(`User ${email} created successfully!`, "success");
    hideCreateForm();
    loadUsers();
  } catch (error) {
    showMessage(`Error creating user: ${error.message}`, "error");
  }
}

// Edit User Functions
function editUser(userId, email, currentRole) {
  document.getElementById("editUserId").value = userId;
  document.getElementById("editEmail").value = email;
  document.getElementById("editRole").value = currentRole.includes("Admin") ? "Admin" : "User";

  document.getElementById("editUserForm").classList.add("active");
  hideCreateForm();
  document.getElementById("editUserForm").scrollIntoView({ behavior: "smooth" });
}

function hideEditForm() {
  document.getElementById("editUserForm").classList.remove("active");
  document.getElementById("editForm").reset();
}

async function handleUpdateUser(event) {
  event.preventDefault();
  const userId = document.getElementById("editUserId").value;
  const email = document.getElementById("editEmail").value;
  const role = document.getElementById("editRole").value;

  try {
    await window.api.updateUser(userId, { email, role });
    showMessage(`User updated successfully!`, "success");
    hideEditForm();
    loadUsers();
  } catch (error) {
    showMessage(`Error updating user: ${error.message}`, "error");
  }
}

// Delete User Function
async function deleteUser(userId, email) {
  if (!confirm(`Are you sure you want to delete user "${email}"? This action cannot be undone.`)) {
    return;
  }

  try {
    await window.api.deleteUser(userId);
    showMessage(`User ${email} deleted successfully!`, "success");
    loadUsers();
  } catch (error) {
    showMessage(`Error deleting user: ${error.message}`, "error");
  }
}

// Promote/Demote Functions
async function promoteUser(userId) {
  try {
    await window.api.promoteToAdmin(userId);
    showMessage("User promoted to Admin successfully!", "success");
    loadUsers();
  } catch (error) {
    showMessage(`Error promoting user: ${error.message}`, "error");
  }
}

async function demoteUser(userId) {
  if (!confirm("Are you sure you want to demote this user from Admin to User?")) {
    return;
  }

  try {
    await window.api.demoteToUser(userId);
    showMessage("User demoted to User role successfully!", "success");
    loadUsers();
  } catch (error) {
    showMessage(`Error demoting user: ${error.message}`, "error");
  }
}

// Expose functions explicitly on window.admin for reliable access from HTML onclicks
// and other scripts. This makes the module usable both as a script tag and when
// referenced from other JS files.
window.admin = {
  isAdminUser,
  loadUsers,
  renderUsers,
  escapeHtml,
  showMessage,
  showCreateForm,
  hideCreateForm,
  handleCreateUser,
  editUser,
  hideEditForm,
  handleUpdateUser,
  deleteUser,
  promoteUser,
  demoteUser,
};
