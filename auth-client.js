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

        // If not demo credentials, try the actual API
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                this.setAuthData(response);
            }

            return response;
        } catch (error) {
            console.error('Login error:', error); // Debug log
            return {
                success: false,
                message: 'Invalid email or password'
            };
        }
    }

    /**
     * Register a new user
     * @param {Object} userData 
     * @returns {Promise<Object>} Registration response
     */
    async signup(userData) {
        try {
            // For demo purposes, simulate successful registration
            console.log('Demo signup with:', userData);
            
            // Store user data (in a real app, this would come from the backend)
            const newUser = {
                firstName: userData.firstName,
                email: userData.email,
                isAdmin: false
            };
            
            // Generate a demo token
            const token = 'demo-' + Math.random().toString(36).substring(2);
            
            // Store auth data
            this.setAuthData({
                token,
                user: newUser
            });
            
            return {
                success: true,
                message: 'Account created successfully'
            };
            
            // In a real app, this would make an API call:
            // return await this.request('/auth/signup', {
            //     method: 'POST',
            //     body: JSON.stringify(userData)
            // });
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Registration failed'
            };
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

        try {
            return await this.request('/usage');
        } catch (error) {
            return { 
                success: false, 
                message: 'Failed to fetch API usage',
                calls: 0
            };
        }
    }
}

// Create a global instance
const authClient = new AuthClient();

// Each page will handle its own authentication checks