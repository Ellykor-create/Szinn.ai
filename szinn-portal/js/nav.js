/**
 * SZINN Portal — Navigation Component
 * Injects nav + footer into every page
 */

const SzinnNav = {
  init() {
    this.renderNav();
    this.renderFooter();
    this.bindEvents();
    this.setActiveLink();
    this.updateUserInfo();
  },

  renderNav() {
    const nav = document.getElementById('szinn-nav');
    if (!nav) return;

    const user = SzinnAuth.getUser();
    const initials = user ? user.initials : '??';
    const name = user ? user.name : '';

    nav.innerHTML = `
      <nav class="nav">
        <div class="nav-inner">
          <a href="/szinn-portal/pages/dashboard.html" class="nav-logo">
            <img src="/szinn-portal/assets/img/logo-gold.png" alt="SZINN" onerror="this.style.display='none'">
            <span class="nav-logo-text">SZINN</span>
          </a>

          <ul class="nav-links" id="nav-links">
            <li><a href="/szinn-portal/pages/dashboard.html" data-page="dashboard">Dashboard</a></li>
            <li><a href="/szinn-portal/pages/questionnaire.html" data-page="questionnaire">Vragenlijst</a></li>
            <li><a href="#" onclick="SzinnAuth.logout(); return false;">Uitloggen</a></li>
          </ul>

          <div class="nav-user">
            <span class="nav-user-name">${name}</span>
            <div class="nav-avatar">${initials}</div>
          </div>

          <button class="nav-hamburger" id="nav-toggle" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>
      <div class="nav-spacer"></div>
    `;
  },

  renderFooter() {
    const footer = document.getElementById('szinn-footer');
    if (!footer) return;

    const year = new Date().getFullYear();
    footer.innerHTML = `
      <footer style="
        text-align: center;
        padding: 40px 20px 30px;
        border-top: 1px solid var(--border);
        margin-top: 60px;
      ">
        <div style="margin-bottom: 12px;">
          <span style="
            font-family: 'Cormorant Garamond', serif;
            font-size: 16px;
            color: var(--gold);
            letter-spacing: 0.1em;
          ">SZINN</span>
        </div>
        <p style="font-size: 11px; color: var(--muted); letter-spacing: 0.08em;">
          &copy; ${year} SZINN &middot; Alterego BV &middot; Alle rechten voorbehouden
        </p>
      </footer>
    `;
  },

  bindEvents() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
    }
  },

  setActiveLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
      if (path.includes(a.dataset.page)) a.classList.add('active');
    });
  },

  updateUserInfo() {
    const user = SzinnAuth.getUser();
    if (user) {
      const nameEl = document.querySelector('.nav-user-name');
      const avatarEl = document.querySelector('.nav-avatar');
      if (nameEl) nameEl.textContent = user.name;
      if (avatarEl) avatarEl.textContent = user.initials;
    }
  }
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('szinn-nav')) {
    SzinnNav.init();
  }
});
