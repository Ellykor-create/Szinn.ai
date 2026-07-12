const SzinnAuth = {
  currentUser: null,

  async login(email, password) {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });
    } catch {
      throw new Error('Geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw.');
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('De server gaf een onverwacht antwoord. Probeer het later opnieuw.');
    }
    if (!res.ok) throw new Error(data.error || 'Inloggen mislukt');
    this.currentUser = data;
    return data;
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    this.currentUser = null;
    window.location.href = '/portaal/inloggen';
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
      window.location.href = '/portaal/inloggen';
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
