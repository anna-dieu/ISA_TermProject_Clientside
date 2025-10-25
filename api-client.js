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
}

// expose to global
window.APIClient = APIClient;
