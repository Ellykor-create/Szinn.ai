const SzinnAuth = {
  currentUser: null,

  async login(email, password) {
    const en = (typeof localStorage !== 'undefined' && localStorage.getItem('szinn_lang') === 'en');
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, lang: en ? 'en' : 'nl' })
      });
    } catch {
      throw new Error(en
        ? 'No connection to the server. Check your internet connection and try again.'
        : 'Geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw.');
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(en
        ? 'The server gave an unexpected response. Please try again later.'
        : 'De server gaf een onverwacht antwoord. Probeer het later opnieuw.');
    }
    if (!res.ok) throw new Error(data.error || (en ? 'Login failed' : 'Inloggen mislukt'));
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
