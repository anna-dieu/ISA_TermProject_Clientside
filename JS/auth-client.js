/**
 * Authentication client for connecting frontend login/signup
 * with ASP.NET Identity backend at https://localhost:5157
 */

class AuthClient {
  constructor() {
    // Base URL for backend API (update this if port changes)
    this.baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";

    // Session manager: in-memory session + sessionStorage (cleared on tab close)
    // Legacy token key kept for backward compatibility with older pages that still read localStorage
    this.storagePrefix = "ai_chat_";
    this.legacyTokenKey = "auth_token"; // kept for compatibility

    // Create a simple session manager wrapper
    this._session = { token: null, user: null };
    this._useSessionStorage = true; // store session in sessionStorage (not localStorage)
  }

  /**
   * Save authentication token and user data locally
   */
  setAuthData(authData) {
    console.log("Setting auth data:", authData);
    // update in-memory session
    this._session.token = authData.token;
    this._session.user = authData.user || null;

    // Persist to sessionStorage so it survives reloads for this tab only
    try {
      if (this._useSessionStorage && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(this.storagePrefix + "token", authData.token);
        if (authData.user)
          sessionStorage.setItem(this.storagePrefix + "user", JSON.stringify(authData.user));
        else sessionStorage.removeItem(this.storagePrefix + "user");
      }
      // Also set legacy token in localStorage for pages that still check it (back-compat)
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.legacyTokenKey, authData.token);
        // Also keep the ai_chat_user in localStorage for backward compatibility
        if (authData.user)
          localStorage.setItem(this.storagePrefix + "user", JSON.stringify(authData.user));
        else localStorage.removeItem(this.storagePrefix + "user");
      }
    } catch (e) {
      console.warn("Failed to persist session data:", e);
    }
  }

  /**
   * Clear all authentication-related data from storage
   */
  clearAuthData() {
    // Clear in-memory
    this._session.token = null;
    this._session.user = null;

    // Clear sessionStorage entries
    try {
      if (this._useSessionStorage && typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(this.storagePrefix + "token");
        sessionStorage.removeItem(this.storagePrefix + "user");
      }
      // Also remove legacy token from localStorage to fully log out older pages
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.legacyTokenKey);
        localStorage.removeItem(this.storagePrefix + "user");
      }
    } catch (e) {
      console.warn("Failed to clear persisted session data:", e);
    }
  }

  /**
   * Retrieve stored JWT token
   */
  getToken() {
    // Prefer in-memory value
    if (this._session.token) return this._session.token;

    // Then try sessionStorage (new behavior)
    try {
      if (this._useSessionStorage && typeof sessionStorage !== "undefined") {
        const t = sessionStorage.getItem(this.storagePrefix + "token");
        if (t) {
          this._session.token = t;
          return t;
        }
      }
    } catch (e) {
      console.warn("Failed to read token from sessionStorage:", e);
    }

    // Fallback to legacy localStorage token for compatibility
    // try {
    //   if (typeof localStorage !== "undefined") {
    //     const lt =
    //       localStorage.getItem(this.legacyTokenKey) ||
    //       localStorage.getItem(this.storagePrefix + "token");
    //     if (lt) {
    //       this._session.token = lt;
    //       return lt;
    //     }
    //   }
    // } catch (e) {
    //   console.warn("Failed to read token from localStorage:", e);
    // }

    return null;
  }

  /**
   * Retrieve stored user information
   */
  getUser() {
    if (this._session.user) return this._session.user;
    try {
      if (this._useSessionStorage && typeof sessionStorage !== "undefined") {
        const u = sessionStorage.getItem(this.storagePrefix + "user");
        if (u) {
          this._session.user = JSON.parse(u);
          return this._session.user;
        }
      }
    } catch (e) {
      console.warn("Failed to read user from sessionStorage:", e);
    }

    return null;
  }

  /**
   * Return true if user has a stored token
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Helper to send raw fetch requests with Authorization header
   */
  async _fetchRaw(endpoint, options = {}) {
    try {
      const headers = Object.assign({}, options.headers || {});
      if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      const token = this.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(this.baseUrl + endpoint, { ...options, headers });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error("Fetch error:", err);
      return { ok: false, status: 0, data: null };
    }
  }

  /**
   * Try to extract a JWT token from backend response
   */
  _extractTokenFromResponse(resp) {
    if (!resp) return null;
    // ASP.NET Identity API can return token in various formats
    // Try resp.data first, then resp directly
    const d = resp.data || resp || {};

    // Try common token property names
    return (
      d.token ||
      d.accessToken ||
      d.access_token ||
      d.jwt ||
      d.bearerToken ||
      d.value?.token ||
      (typeof d === "string" ? d : null) || // If response is just a string token
      null
    );
  }

  // -------------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------------
  /**
   * Login a user by sending credentials to ASP.NET Identity endpoint (Bearer token)
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    const res = await fetch(this.baseUrl + "/login", {
      // Identity API Bearer token endpoint
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data?.message || "Login failed" };

    // Extract Bearer token from response
    const token = data.accessToken || data.token;
    if (token) {
      console.log("Token received, storing auth data");
      this.setAuthData({ token, user: { email } });
      return { success: true, user: { email } };
    } else {
      console.warn("No token in login response:", data);
      return { success: false, message: "No token received" };
    }
  }

  // -------------------------------------------------------------------
  // SIGNUP
  // -------------------------------------------------------------------
  /**
   * Register a new user with ASP.NET Identity backend
   * @param {Object} userData
   */
  async signup(userData) {
    console.log("Signup attempt:", userData);

    const endpoint = "/register"; // ASP.NET Identity registration endpoint
    const body = JSON.stringify(userData);
    const headers = { "Content-Type": "application/json" };

    const res = await this._fetchRaw(endpoint, { method: "POST", headers, body });
    if (!res || !res.ok) {
      console.warn("Signup failed:", res);
      return { success: false, message: "Registration failed" };
    }

    const token = this._extractTokenFromResponse(res.data);
    if (token) {
      // Auto-login after successful signup
      this.setAuthData({ token });
      return { success: true, token };
    }

    return { success: false, message: "Signup successful, but failed to retrieve token" };
  }

  // -------------------------------------------------------------------
  // USER FETCH
  // -------------------------------------------------------------------
  /**
   * Fetch the authenticated user's profile from the server
   */
  async fetchUser() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(this.baseUrl + "/api/account/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return null;
      const user = await res.json();
      this._session.user = user;
      if (this._useSessionStorage)
        sessionStorage.setItem(this.storagePrefix + "user", JSON.stringify(user));
      return user;
    } catch (e) {
      return null;
    }
  }

  // -------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------
  /**
   * Logout the current user (with Bearer tokens, just clear local data)
   */
  async logout() {
    // With Bearer tokens, we just clear local data (no server-side session to invalidate)
    this.clearAuthData();
    window.location.href = "login.html";
  }

  /**
   * Fetch API usage (keeps compatibility with older pages that call authClient.getApiUsage())
   */
  async getApiUsage() {
    const token = this.getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(this.baseUrl + "/api/OpenAi/usage", {
        method: "GET",
        headers,
      });
      if (!res.ok) return { success: false, message: "Failed to fetch usage", calls: 0 };
      const data = await res.json();
      return { success: true, calls: data.calls || 0, raw: data };
    } catch (e) {
      return { success: false, message: e?.message || String(e), calls: 0 };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User's email address
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async sendPasswordReset(email) {
    try {
      const res = await fetch(this.baseUrl + "/api/account/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        return { success: true, message: "Password reset link sent to your email" };
      } else {
        const errorText = await res.text();
        return { success: false, message: errorText || "Failed to send reset link" };
      }
    } catch (e) {
      return { success: false, message: e?.message || "Network error" };
    }
  }
}

// Expose a global instance for pages that load this file with a plain <script> tag
const authClientInstance = new AuthClient();
window.authClient = authClientInstance;

// Note: we intentionally avoid using ES module `export` here so the file can be
// loaded directly with a plain <script> tag. Module consumers can wrap or import
// this file with their build tools if needed.
