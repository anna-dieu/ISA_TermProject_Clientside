/**
 * Authentication client for connecting frontend login/signup
 * with ASP.NET Identity backend at https://localhost:5157
 */

class AuthClient {
  constructor() {
    // Base URL for backend API (update this if port changes)
    this.baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";

    // Storage keys for tokens and user data
    this.storagePrefix = "ai_chat_";
    this.legacyTokenKey = "auth_token"; // kept for compatibility
  }

  /**
   * Save authentication token and user data locally
   */
  setAuthData(authData) {
    console.log("Setting auth data:", authData);
    localStorage.setItem(this.storagePrefix + "token", authData.token);
    localStorage.setItem(this.legacyTokenKey, authData.token);
    if (authData.user) {
      localStorage.setItem(this.storagePrefix + "user", JSON.stringify(authData.user));
    }
  }

  /**
   * Clear all authentication-related data from storage
   */
  clearAuthData() {
    localStorage.removeItem(this.storagePrefix + "token");
    localStorage.removeItem(this.legacyTokenKey);
    localStorage.removeItem(this.storagePrefix + "user");
  }

  /**
   * Retrieve stored JWT token
   */
  getToken() {
    const token =
      localStorage.getItem(this.storagePrefix + "token") ||
      localStorage.getItem(this.legacyTokenKey);
    console.log("Current token:", token);
    return token;
  }

  /**
   * Retrieve stored user information
   */
  getUser() {
    const userData = localStorage.getItem(this.storagePrefix + "user");
    console.log("Current user data:", userData);
    return userData ? JSON.parse(userData) : null;
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
   * Login a user by sending credentials to ASP.NET Identity endpoint
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    console.log("Login attempt:", email);

    const endpoint = "/login"; // ASP.NET Identity login endpoint
    const body = JSON.stringify({ email, password });
    const headers = { "Content-Type": "application/json" };

    const res = await this._fetchRaw(endpoint, { method: "POST", headers, body });

    console.log("Login raw response:", res);
    console.log("Login response data:", res.data);
    console.log("Login response status:", res.status);

    if (!res || !res.ok) {
      console.warn("Login failed:", res);
      // Try to get more details from error response
      let errorMsg = "Invalid email or password";
      if (res.data) {
        if (res.data.errors) {
          errorMsg = Object.values(res.data.errors).flat().join(", ");
        } else if (res.data.message) {
          errorMsg = res.data.message;
        }
      }
      return { success: false, message: errorMsg };
    }

    // ASP.NET Identity API may return token in response.data or directly
    let token = this._extractTokenFromResponse(res.data);

    // If token not found, try the raw response
    if (!token && res.data && typeof res.data === "object") {
      // Try accessing properties directly
      token = res.data.token || res.data.accessToken || res.data.bearerToken;
    }

    console.log(
      "Extracted token:",
      token ? "Token found (" + token.substring(0, 20) + "...)" : "No token"
    );
    console.log("Full response structure:", JSON.stringify(res.data, null, 2));

    if (token) {
      const user = res.data?.user || { email, userName: email };
      this.setAuthData({ token, user });
      console.log("Auth data saved:", { token: token.substring(0, 20) + "...", user });
      return { success: true, token, user };
    }

    // If no token in response, check if login was successful but token is missing
    console.error("Login response (no token):", res.data);
    return {
      success: false,
      message: "Login failed: No token returned. Response: " + JSON.stringify(res.data),
    };
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
      const user = res.data.user || { email: userData.email };
      this.setAuthData({ token, user });
      return { success: true, token, user };
    }

    return { success: true, data: res.data };
  }

  // -------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------
  logout() {
    this.clearAuthData();
    window.location.href = "login.html";
  }

  // -------------------------------------------------------------------
  // API USAGE (optional feature)
  // -------------------------------------------------------------------
  async getApiUsage() {
    if (!this.isAuthenticated()) {
      return { success: false, message: "Not authenticated" };
    }

    const res = await this._fetchRaw("/usage", { method: "GET" });
    if (res.ok && res.data) {
      return { success: true, calls: res.data.calls || 0, raw: res.data };
    }

    return { success: false, message: "Failed to fetch usage", calls: 0 };
  }
}

// Create a global instance
const authClient = new AuthClient();
window.authClient = authClient; // Expose globally
