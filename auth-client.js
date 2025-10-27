/**
 * Authentication client for handling login, signup, and API usage tracking
 */
class AuthClient {
    constructor() {
        // Base API URL. Can be overridden by adding a small config.js that sets window.APP_CONFIG.API_BASE
        // Example config.js: window.APP_CONFIG = { API_BASE: 'http://localhost:5000' }
        this.baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || 'http://localhost:5000';
        this.storagePrefix = 'ai_chat_';
        // keep a legacy key for compatibility with other pages
        this.legacyTokenKey = 'auth_token';
    }

    /**
     * Store authentication token and any user info
     * @param {Object} authData - Authentication data including token
     */
    setAuthData(authData) {
        console.log('Setting auth data:', authData); // Debug log
        // primary (namespaced) storage
        localStorage.setItem(this.storagePrefix + 'token', authData.token);
        // legacy key for pages that still read 'auth_token'
        localStorage.setItem(this.legacyTokenKey, authData.token);
        if (authData.user) {
            localStorage.setItem(this.storagePrefix + 'user', JSON.stringify(authData.user));
        }
    }

    /**
     * Clear all authentication data from storage
     */
    clearAuthData() {
        localStorage.removeItem(this.storagePrefix + 'token');
        localStorage.removeItem(this.legacyTokenKey);
        localStorage.removeItem(this.storagePrefix + 'user');
    }

    /**
     * Get the current authentication token
     * @returns {string|null} The authentication token if present
     */
    getToken() {
        // prefer namespaced token, fall back to legacy key for compatibility
        const token = localStorage.getItem(this.storagePrefix + 'token') || localStorage.getItem(this.legacyTokenKey);
        console.log('Current token:', token); // Debug log
        return token;
    }

    /**
     * Get the current user data
     * @returns {Object|null} The user data if present
     */
    getUser() {
        const userData = localStorage.getItem(this.storagePrefix + 'user');
        console.log('Current user data:', userData); // Debug log
        return userData ? JSON.parse(userData) : null;
    }

    /**
     * Check if the user is currently authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        const token = this.getToken();
        const authenticated = !!token;
        console.log('Is authenticated:', authenticated); // Debug log
        return authenticated;
    }

    /**
     * Make an authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} API response
     */
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        try {
            const response = await fetch(this.baseUrl + endpoint, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Helper: low-level fetch that returns { ok, data, status }
    async _fetchRaw(endpoint, options = {}){
        try{
            // Ensure headers exist and include Authorization when available
            const headers = Object.assign({}, options.headers || {});
            if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }
            const token = this.getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(this.baseUrl + endpoint, { ...options, headers });
            let data = null;
            try{ data = await res.json(); } catch(e){ data = null; }
            return { ok: res.ok, status: res.status, data };
        }catch(err){
            console.error('Fetch raw error for', endpoint, err);
            return { ok:false, status: 0, data: null };
        }
    }

    // Helper: tolerant token extractor from many common shapes
    _extractTokenFromResponse(resp){
        if(!resp) return null;
        const d = resp.data || resp || {};
        return d.token || d.accessToken || d.access_token || d.jwt || d.result?.token || d.value?.token || null;
    }

    /**
     * Attempt to log in a user
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<Object>} Login response
     */
    async login(email, password) {
        console.log('Login attempt:', { email }); // Debug log

        // For demo purposes, handle demo credentials directly
        if (email === 'admin@admin.com' && password === '111') {
            const authData = {
                success: true,
                token: 'admin-demo-token',
                user: { email, isAdmin: true }
            };
            this.setAuthData(authData);
            console.log('Admin login successful'); // Debug log
            return authData;
        }
        
        if (email === 'john@john.com' && password === '123') {
            const authData = {
                success: true,
                token: 'user-demo-token',
                user: { email, isAdmin: false }
            };
            this.setAuthData(authData);
            console.log('User login successful'); // Debug log
            return authData;
        }

        console.log('No matching demo credentials'); // Debug log

        // If not demo credentials, try a list of likely API endpoints and accept common response shapes
        const endpoints = [
            // Common custom API routes
            '/api/auth/login', '/auth/login',
            // Account-based endpoints inferred from IAccountService
            '/api/account/login', '/account/login',
            // Identity area / default conventions
            '/api/identity/login', '/identity/login',
            '/api/identity/account/login', '/identity/account/login'
        ];

        const body = JSON.stringify({ email, password });
        const headers = { 'Content-Type': 'application/json' };

        for (const ep of endpoints) {
            const res = await this._fetchRaw(ep, { method: 'POST', headers, body });
            if (!res) continue;
            if (res.ok) {
                // Try to extract a token
                const token = this._extractTokenFromResponse(res.data);
                if (token) {
                    const user = res.data.user || res.data.data?.user || { email };
                    this.setAuthData({ token, user });
                    return { success: true, token, user };
                }
                // If backend returned success without token (maybe cookie-based auth)
                if (res.data && (res.data.success || res.data.isSuccess)) {
                    return { success: true, data: res.data };
                }
                // Otherwise, return the raw data as a success
                return { success: true, data: res.data };
            }
        }

        // Fallback: check for locally stored demo user (created via signup)
        const localUserRaw = localStorage.getItem(this.storagePrefix + 'user');
        if (localUserRaw) {
            const localUser = JSON.parse(localUserRaw);
            // Only match if email matches what was stored at signup
            // Note: password is not stored, so allow any password for demo user
            if (localUser.email === email) {
                const token = localStorage.getItem(this.storagePrefix + 'token');
                this.setAuthData({ token, user: localUser });
                return { success: true, token, user: localUser };
            }
        }

        // If none of the endpoints worked
        return { success: false, message: 'Invalid email or password' };
    }

    /**
     * Register a new user
     * @param {Object} userData 
     * @returns {Promise<Object>} Registration response
     */
    async signup(userData) {
        try {
            console.log('Signup attempt:', userData);

            // Try likely signup endpoints
            const endpoints = [
                // Common custom API routes
                '/api/auth/signup', '/auth/signup',
                // Account-based endpoints inferred from IAccountService
                '/api/account/register', '/account/register',
                '/api/account/register', '/account/register',
                // Identity area / default conventions
                '/api/identity/register', '/identity/register',
                '/api/identity/account/register', '/identity/account/register'
            ];

            const body = JSON.stringify(userData);
            const headers = { 'Content-Type': 'application/json' };

            for (const ep of endpoints) {
                const res = await this._fetchRaw(ep, { method: 'POST', headers, body });
                if (!res) continue;
                if (res.ok) {
                    // If token present, store it
                    const token = this._extractTokenFromResponse(res.data);
                    if (token) {
                        const user = res.data.user || res.data.data?.user || { email: userData.email, firstName: userData.firstName };
                        this.setAuthData({ token, user });
                        return { success: true, token, user };
                    }
                    // Otherwise return backend response
                    return { success: true, data: res.data };
                }
            }

            // Fallback: demo signup behavior if backend not reachable
            console.log('Backend signup endpoints did not respond; falling back to demo signup');
            const newUser = {
                firstName: userData.firstName,
                email: userData.email,
                isAdmin: false
            };
            const token = 'demo-' + Math.random().toString(36).substring(2);
            this.setAuthData({ token, user: newUser });
            return { success: true, message: 'Account created locally (demo)' };
        } catch (error) {
            return { success: false, message: error.message || 'Registration failed' };
        }
    }

    /**
     * Log out the current user
     */
    logout() {
        this.clearAuthData();
        window.location.href = '/login.html';
    }

    /**
     * Get the current API usage for the user
     * @returns {Promise<Object>} API usage data
     */
    async getApiUsage() {
        if (!this.isAuthenticated()) {
            return { success: false, message: 'Not authenticated' };
        }

        // Try common usage endpoints
        const endpoints = ['/api/usage', '/usage'];
        for (const ep of endpoints) {
            const res = await this._fetchRaw(ep, { method: 'GET' });
            if (!res) continue;
            if (res.ok && res.data) {
                return { success: true, calls: res.data.calls ?? res.data.count ?? res.data.usage ?? 0, raw: res.data };
            }
        }

        return { 
            success: false, 
            message: 'Failed to fetch API usage',
            calls: 0
        };
    }

    /**
     * Confirm a user's email using userId and token
     * @param {string} userId
     * @param {string} token
     */
    async confirmEmail(userId, token) {
        const endpoints = [
            '/api/account/confirm-email', '/account/confirm-email',
            '/api/auth/confirm-email', '/auth/confirm-email',
            '/api/identity/confirm-email', '/identity/confirm-email'
        ];

        // Try POST body
        const body = JSON.stringify({ userId, token });
        const headers = { 'Content-Type': 'application/json' };

        for (const ep of endpoints) {
            const res = await this._fetchRaw(ep, { method: 'POST', headers, body });
            if (!res) continue;
            if (res.ok) return { success: true, data: res.data };
        }

        // Try GET with query params
        for (const ep of endpoints) {
            const url = ep + `?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
            const res = await this._fetchRaw(url, { method: 'GET' });
            if (!res) continue;
            if (res.ok) return { success: true, data: res.data };
        }

        return { success: false, message: 'Failed to confirm email' };
    }

    /**
     * Trigger sending of a password reset link to an email
     * @param {string} email
     */
    async sendPasswordReset(email) {
        const endpoints = [
            '/api/account/send-password-reset', '/account/send-password-reset',
            '/api/account/forgot-password', '/account/forgot-password',
            '/api/auth/forgot-password', '/auth/forgot-password'
        ];

        const body = JSON.stringify({ email });
        const headers = { 'Content-Type': 'application/json' };

        for (const ep of endpoints) {
            const res = await this._fetchRaw(ep, { method: 'POST', headers, body });
            if (!res) continue;
            if (res.ok) return { success: true, data: res.data };
        }

        return { success: false, message: 'Failed to send password reset link' };
    }

    /**
     * Reset password using model { userId?, email?, token, newPassword }
     * @param {Object} model
     */
    async resetPassword(model) {
        const endpoints = ['/api/account/reset-password', '/account/reset-password', '/api/auth/reset-password', '/auth/reset-password'];
        const body = JSON.stringify(model);
        const headers = { 'Content-Type': 'application/json' };

        for (const ep of endpoints) {
            const res = await this._fetchRaw(ep, { method: 'POST', headers, body });
            if (!res) continue;
            if (res.ok) return { success: true, data: res.data };
        }

        return { success: false, message: 'Failed to reset password' };
    }

    /**
     * Lookup a user profile by email
     * @param {string} email
     */
    async getProfileByEmail(email) {
        const endpoints = ['/api/account/profile', '/account/profile', '/api/profile', '/profile'];
        for (const ep of endpoints) {
            // try query param
            const url = ep + `?email=${encodeURIComponent(email)}`;
            const res = await this._fetchRaw(url, { method: 'GET' });
            if (!res) continue;
            if (res.ok) return { success: true, data: res.data };
        }
        return { success: false, message: 'Profile not found' };
    }
}

// Create a global instance
const authClient = new AuthClient();

// Each page will handle its own authentication checks