/**
 * Authentication client for connecting frontend login/signup
 * with ASP.NET Identity backend at https://localhost:5157
 */

class AuthClient {
    constructor() {
        // Base URL for backend API (update this if port changes)
        this.baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || 'https://localhost:5157';

        // Storage keys for tokens and user data
        this.storagePrefix = 'ai_chat_';
        this.legacyTokenKey = 'auth_token'; // kept for compatibility
    }

    /** 
     * Save authentication token and user data locally 
     */
    setAuthData(authData) {
        console.log('Setting auth data:', authData);
        localStorage.setItem(this.storagePrefix + 'token', authData.token);
        localStorage.setItem(this.legacyTokenKey, authData.token);
        if (authData.user) {
            localStorage.setItem(this.storagePrefix + 'user', JSON.stringify(authData.user));
        }
    }

    /** 
     * Clear all authentication-related data from storage 
     */
    clearAuthData() {
        localStorage.removeItem(this.storagePrefix + 'token');
        localStorage.removeItem(this.legacyTokenKey);
        localStorage.removeItem(this.storagePrefix + 'user');
    }

    /** 
     * Retrieve stored JWT token 
     */
    getToken() {
        const token = localStorage.getItem(this.storagePrefix + 'token') ||
                      localStorage.getItem(this.legacyTokenKey);
        console.log('Current token:', token);
        return token;
    }

    /** 
     * Retrieve stored user information 
     */
    getUser() {
        const userData = localStorage.getItem(this.storagePrefix + 'user');
        console.log('Current user data:', userData);
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
            if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }

            const token = this.getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(this.baseUrl + endpoint, { ...options, headers });
            let data = null;
            try { data = await res.json(); } catch { data = null; }

            return { ok: res.ok, status: res.status, data };
        } catch (err) {
            console.error('Fetch error:', err);
            return { ok: false, status: 0, data: null };
        }
    }

    /** 
     * Try to extract a JWT token from backend response 
     */
    _extractTokenFromResponse(resp) {
        if (!resp) return null;
        const d = resp.data || resp || {};
        return d.token || d.accessToken || d.access_token || d.jwt || d.value?.token || null;
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
        console.log('Login attempt:', email);

        const endpoint = '/login'; // ASP.NET Identity login endpoint
        const body = JSON.stringify({ email, password });
        const headers = { 'Content-Type': 'application/json' };

        const res = await this._fetchRaw(endpoint, { method: 'POST', headers, body });
        if (!res || !res.ok) {
            console.warn('Login failed:', res);
            return { success: false, message: 'Invalid email or password' };
        }

        const token = this._extractTokenFromResponse(res.data);
        if (token) {
            const user = res.data.user || { email };
            this.setAuthData({ token, user });
            return { success: true, token, user };
        }

        return { success: false, message: 'Login failed: No token returned' };
    }

    // -------------------------------------------------------------------
    // SIGNUP
    // -------------------------------------------------------------------
    /**
     * Register a new user with ASP.NET Identity backend
     * @param {Object} userData 
     */
    async signup(userData) {
        console.log('Signup attempt:', userData);

        const endpoint = '/register'; // ASP.NET Identity registration endpoint
        const body = JSON.stringify(userData);
        const headers = { 'Content-Type': 'application/json' };

        const res = await this._fetchRaw(endpoint, { method: 'POST', headers, body });
        if (!res || !res.ok) {
            console.warn('Signup failed:', res);
            return { success: false, message: 'Registration failed' };
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
    window.location.href = 'login.html';
    }

    // -------------------------------------------------------------------
    // API USAGE (optional feature)
    // -------------------------------------------------------------------
    async getApiUsage() {
        if (!this.isAuthenticated()) {
            return { success: false, message: 'Not authenticated' };
        }

        const res = await this._fetchRaw('/usage', { method: 'GET' });
        if (res.ok && res.data) {
            return { success: true, calls: res.data.calls || 0, raw: res.data };
        }

        return { success: false, message: 'Failed to fetch usage', calls: 0 };
    }
}

// Create a global instance
const authClient = new AuthClient();
