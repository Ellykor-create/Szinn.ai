/* SZINN Companion — side drawer (coming soon).
   Zelfstandige component: injecteert eigen stijl, een zwevende launcher en een
   uitschuivend paneel. De chat staat bewust op "binnenkort beschikbaar" — de
   gebruiker kan het paneel openen en warm worden gemaakt, maar nog niet chatten.
   Insluiten met: <script src="../js/companion-drawer.js"></script> */
(function () {
  if (window.__szinnCompanionDrawer) return;
  window.__szinnCompanionDrawer = true;

  var lang = (window.SZINN_LANG ||
    (document.documentElement.getAttribute('lang') || 'nl')).toLowerCase().indexOf('en') === 0 ? 'en' : 'nl';

  var T = {
    nl: {
      launch: 'Companion',
      title: 'SZINN Companion',
      subtitle: 'Een rustige plek voor je vragen over je Blueprint',
      welcomeFirst: 'Leuk je te ontmoeten. Ik ben je Companion. Straks kun je me hier van alles vragen over je Blueprint: waar je jezelf in herkent, wat een stuk voor jou betekent, of welke kleine stap bij vandaag past. Ik denk rustig met je mee, zonder oordeel.',
      welcomeReturn: 'Fijn je weer te spreken. Ik ben er zo weer voor je vragen over je Blueprint: waar je jezelf in herkent, wat een stuk voor jou betekent, of welke stap bij vandaag past. We pakken het rustig op, in jouw tempo.',
      soonBadge: 'Binnenkort beschikbaar',
      soonBody: 'De Companion wordt nu met zorg voorbereid. Heel binnenkort kun je hier een echt gesprek voeren over je Blueprint.',
      placeholder: 'Binnenkort kun je hier je vraag stellen…',
      send: 'Stuur',
      close: 'Sluiten',
      hint: 'Je gesprekken blijven altijd van jou.',
    },
    en: {
      launch: 'Companion',
      title: 'SZINN Companion',
      subtitle: 'A calm place for your questions about your Blueprint',
      welcomeFirst: 'Lovely to meet you. I am your Companion. Soon you can ask me anything about your Blueprint here: where you recognise yourself, what a part means for you, or which small step fits today. I think along with you, gently and without judgement.',
      welcomeReturn: 'Good to talk again. Soon I will be here for your questions about your Blueprint: where you recognise yourself, what a part means for you, or which step fits today. We take it gently, at your pace.',
      soonBadge: 'Coming soon',
      soonBody: 'The Companion is being prepared with care. Very soon you will be able to have a real conversation about your Blueprint here.',
      placeholder: 'Soon you can ask your question here…',
      send: 'Send',
      close: 'Close',
      hint: 'Your conversations always remain yours.',
    },
  }[lang];

  var css = '' +
  '.szc-launch{position:fixed;right:22px;bottom:22px;z-index:9998;display:inline-flex;align-items:center;gap:9px;' +
    'background:linear-gradient(135deg,#C9A96E,#A67C3A);color:#FFFDF8;border:none;border-radius:999px;' +
    'padding:12px 20px;font-family:"Jost",sans-serif;font-size:14px;letter-spacing:.04em;cursor:pointer;' +
    'box-shadow:0 10px 30px rgba(120,86,32,.35);transition:transform .18s ease,box-shadow .18s ease}' +
  '.szc-launch:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(120,86,32,.42)}' +
  '.szc-launch .szc-spark{font-size:15px;line-height:1}' +
  '.szc-overlay{position:fixed;inset:0;z-index:9998;background:rgba(28,24,16,.38);backdrop-filter:blur(2px);' +
    'opacity:0;visibility:hidden;transition:opacity .28s ease}' +
  '.szc-overlay.open{opacity:1;visibility:visible}' +
  '.szc-drawer{position:fixed;top:0;right:0;bottom:0;z-index:9999;width:390px;max-width:92vw;' +
    'background:linear-gradient(180deg,#FFFEFC 0%,#FBF6EC 100%);box-shadow:-18px 0 50px rgba(28,24,16,.22);' +
    'transform:translateX(100%);transition:transform .32s cubic-bezier(.22,.61,.36,1);display:flex;flex-direction:column;' +
    'font-family:"Jost",sans-serif;color:#2c2622}' +
  '.szc-drawer.open{transform:translateX(0)}' +
  '.szc-head{padding:22px 22px 16px;border-bottom:1px solid rgba(166,124,58,.18);position:relative}' +
  '.szc-eyebrow{font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:#A67C3A;margin-bottom:6px}' +
  '.szc-title{font-family:"Cormorant Garamond",serif;font-size:26px;font-weight:600;color:#1f1a14;line-height:1.1}' +
  '.szc-sub{font-size:12.5px;color:#8a7860;margin-top:5px;line-height:1.5}' +
  '.szc-close{position:absolute;top:16px;right:16px;width:30px;height:30px;border:none;background:rgba(166,124,58,.1);' +
    'color:#6b5a3e;border-radius:50%;font-size:17px;line-height:1;cursor:pointer;transition:.15s}' +
  '.szc-close:hover{background:rgba(166,124,58,.2)}' +
  '.szc-body{flex:1;overflow-y:auto;padding:18px 22px}' +
  '.szc-bubble{background:#F6F0E6;border:1px solid rgba(166,124,58,.16);border-radius:16px 16px 16px 4px;' +
    'padding:14px 16px;font-size:13.5px;line-height:1.7;color:#3a332a;max-width:92%}' +
  '.szc-soon{margin-top:18px;text-align:center;padding:18px 16px;border:1px dashed rgba(166,124,58,.4);' +
    'border-radius:14px;background:rgba(201,169,110,.06)}' +
  '.szc-soon-badge{display:inline-block;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#A67C3A;' +
    'background:#F0E6CE;border:1px solid rgba(166,124,58,.35);border-radius:999px;padding:5px 14px;margin-bottom:10px}' +
  '.szc-soon-body{font-size:12.5px;line-height:1.65;color:#6b5a3e}' +
  '.szc-foot{border-top:1px solid rgba(166,124,58,.18);padding:14px 22px 18px}' +
  '.szc-inrow{display:flex;gap:8px;align-items:center;opacity:.6}' +
  '.szc-inrow input{flex:1;background:#F6F0E6;border:1px solid rgba(166,124,58,.2);border-radius:12px;' +
    'padding:11px 14px;font-family:"Jost",sans-serif;font-size:13px;color:#2c2622}' +
  '.szc-inrow input::placeholder{color:#a99b82}' +
  '.szc-inrow button{background:linear-gradient(180deg,#C9A96E,#A67C3A);color:#FFFDF8;border:none;border-radius:12px;' +
    'padding:0 18px;height:42px;font-family:"Jost",sans-serif;font-size:13px;cursor:not-allowed}' +
  '.szc-lock{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:#a08a63;margin-top:10px}' +
  '@media(max-width:600px){.szc-launch{right:14px;bottom:14px}.szc-drawer{width:100vw;max-width:100vw}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var launch = document.createElement('button');
  launch.className = 'szc-launch';
  launch.setAttribute('aria-label', T.launch);
  launch.innerHTML = '<span class="szc-spark">✦</span><span>' + T.launch + '</span>';

  var overlay = document.createElement('div');
  overlay.className = 'szc-overlay';

  var drawer = document.createElement('aside');
  drawer.className = 'szc-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', T.title);
  drawer.innerHTML = '' +
    '<div class="szc-head">' +
      '<button class="szc-close" aria-label="' + T.close + '">×</button>' +
      '<div class="szc-eyebrow">SZINN</div>' +
      '<div class="szc-title">' + T.title + '</div>' +
      '<div class="szc-sub">' + T.subtitle + '</div>' +
    '</div>' +
    '<div class="szc-body">' +
      '<div class="szc-bubble" id="szc-greeting"></div>' +
      '<div class="szc-soon">' +
        '<span class="szc-soon-badge">' + T.soonBadge + '</span>' +
        '<div class="szc-soon-body">' + T.soonBody + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="szc-foot">' +
      '<div class="szc-inrow">' +
        '<input type="text" placeholder="' + T.placeholder + '" disabled>' +
        '<button type="button" disabled>' + T.send + '</button>' +
      '</div>' +
      '<div class="szc-lock">🔒 ' + T.hint + '</div>' +
    '</div>';

  document.body.appendChild(launch);
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  var greeting = drawer.querySelector('#szc-greeting');
  function open() {
    // Eerste keer: kennismaken. Daarna: fijn je weer te spreken.
    var seen = false;
    try { seen = localStorage.getItem('szinn_companion_seen') === '1'; } catch (e) {}
    greeting.textContent = seen ? T.welcomeReturn : T.welcomeFirst;
    try { localStorage.setItem('szinn_companion_seen', '1'); } catch (e) {}
    overlay.classList.add('open'); drawer.classList.add('open');
  }
  function close() { overlay.classList.remove('open'); drawer.classList.remove('open'); }

  launch.addEventListener('click', open);
  overlay.addEventListener('click', close);
  drawer.querySelector('.szc-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // Zodat andere knoppen (bv. bestaande "Praat met je Companion") het paneel kunnen openen.
  window.SzinnCompanion = { open: open, close: close };
})();
