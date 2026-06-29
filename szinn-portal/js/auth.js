const SzinnAuth = {
  currentUser: null,

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');
    this.currentUser = data;
    return data;
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    this.currentUser = null;
    window.location.href = '/szinn-portal/pages/login.html';
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  getUser() {
    return this.currentUser;
  },

  async requireAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      this.currentUser = await res.json();
      return true;
    } catch {
      window.location.href = '/szinn-portal/pages/login.html';
      return false;
    }
  },

  async checkSession() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return false;
      this.currentUser = await res.json();
      return true;
    } catch {
      return false;
    }
  }
};
