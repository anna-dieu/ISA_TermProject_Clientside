/* api-client.js
   Provides APIClient used by multiple pages. Returns mocked data when backend unavailable.
*/
class APIClient {
  constructor(base = ''){ this.base = base; }

  async polish(text, tone = 'professional'){
    try{
      const res = await fetch(`${this.base}/api/polish`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text, tone})
      });
      if(!res.ok) throw new Error('polish failed');
      const data = await res.json();
      return data.polished || data.text || '';
    }catch(e){
      // Mocked fallback
      return `Polished (${tone}): ${text}`;
    }
  }

  async saveMessage(role, text, tone = ''){
    try{
      await fetch(`${this.base}/api/messages`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({role, text, tone})
      });
    }catch(e){
      // ignore in dev
    }
  }

  // Returns mocked conversations for dashboard if backend not available
  async listConversations(){
    try{
      const res = await fetch(`${this.base}/api/conversations`);
      if(!res.ok) throw new Error('list failed');
      return await res.json();
    }catch(e){
      // Mocked data
      return [
        { id: '1', title: 'Work: Sick note', last: 'I\'m not feeling well today', updated: '2025-10-24' },
        { id: '2', title: 'Reply to boss', last: 'Thanks, I will review this afternoon', updated: '2025-10-20' },
        { id: '3', title: 'Personal: Date reply', last: 'I\'d love to meet up Saturday', updated: '2025-10-18' }
      ];
    }
  }

    // Calls backend ChatGPT rewrite endpoint
    async rewriteText(userText, tone = 'default') {
      const token = window.authClient?.getToken?.();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/openai/rewrite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userText, tone })
      });
      if (!res.ok) throw new Error('Rewrite failed');
      const data = await res.json();
      return data.rewrittenText || '';
    }

    // Calls backend usage endpoint for OpenAI
    async getOpenAiUsage() {
      const token = window.authClient?.getToken?.();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/openai/usage`, {
        method: 'GET',
        headers
      });
      if (!res.ok) throw new Error('Usage fetch failed');
      return await res.json();
    }

    // ========================================
    // ADMIN USER MANAGEMENT METHODS
    // ========================================
    
    /**
     * Get all users (Admin only)
     */
    async getUsers() {
      // Try multiple ways to get the token
      let token = null;
      if (window.authClient && typeof window.authClient.getToken === 'function') {
        token = window.authClient.getToken();
      }
      if (!token) {
        token = localStorage.getItem('auth_token') || localStorage.getItem('ai_chat_token');
      }
      
      if (!token) {
        throw new Error('Not authenticated - Please log in');
      }
      
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${token}`;

      console.log('Fetching users from:', `${this.base}/api/admin/AdminUsers`);
      
      const res = await fetch(`${this.base}/api/admin/AdminUsers`, {
        method: 'GET',
        headers
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Authentication failed - Please log in again');
        } else if (res.status === 403) {
          throw new Error('Access denied - Admin role required');
        }
        throw new Error(errorData.message || `Failed to fetch users (${res.status})`);
      }
      return await res.json();
    }

    /**
     * Get a single user by ID (Admin only)
     */
    async getUser(userId) {
      const token = window.authClient?.getToken?.();
      if (!token) throw new Error('Not authenticated');
      
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/admin/AdminUsers/${userId}`, {
        method: 'GET',
        headers
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        throw new Error('Failed to fetch user');
      }
      return await res.json();
    }

    /**
     * Create a new user (Admin only)
     */
    async createUser(userData) {
      const token = window.authClient?.getToken?.();
      if (!token) throw new Error('Not authenticated');
      
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/admin/AdminUsers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(userData)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errors = errorData.errors || errorData;
        const errorMessages = Array.isArray(errors) 
          ? errors.map(e => e.description || e.message || e).join(', ')
          : (errorData.message || 'Failed to create user');
        throw new Error(errorMessages);
      }
      return await res.json();
    }

    /**
     * Update a user (Admin only)
     */
    async updateUser(userId, userData) {
      const token = window.authClient?.getToken?.();
      if (!token) throw new Error('Not authenticated');
      
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/admin/AdminUsers/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(userData)
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        const errorData = await res.json().catch(() => ({}));
        const errors = errorData.errors || errorData;
        const errorMessages = Array.isArray(errors) 
          ? errors.map(e => e.description || e.message || e).join(', ')
          : (errorData.message || 'Failed to update user');
        throw new Error(errorMessages);
      }
      return true;
    }

    /**
     * Delete a user (Admin only)
     */
    async deleteUser(userId) {
      const token = window.authClient?.getToken?.();
      if (!token) throw new Error('Not authenticated');
      
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.base}/api/admin/AdminUsers/${userId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('User not found');
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete user');
      }
      return true;
    }

    /**
     * Promote a user to Admin role
     */
    async promoteToAdmin(userId) {
      return await this.updateUser(userId, { role: 'Admin' });
    }

    /**
     * Demote a user to User role (or remove Admin role)
     */
    async demoteToUser(userId) {
      return await this.updateUser(userId, { role: 'User' });
    }
}

// expose to global
window.APIClient = APIClient;
