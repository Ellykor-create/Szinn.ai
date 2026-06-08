# SZINN.ai Website Deploy

## Mappenstructuur

```
szinn.ai/ (Netlify root)
├── index.html              ← NL hoofdpagina (al in repo, niet aangeraakt)
├── en/
│   └── index.html          ← EN hoofdpagina (VERNIEUWD)
├── intake/
│   ├── index.html          ← NL intake formulier (NIEUW)
│   └── en/
│       └── index.html      ← EN intake formulier (NIEUW)
├── assets/
│   ├── logo.png            ← Triskelion logo (transparant)
│   └── szinn-hero.jpg      ← Hero afbeelding
└── privacy/
    └── index.html          ← Privacyverklaring (NIEUW)
```

## Flows

### Nederlandse flow
1. szinn.ai → NL homepage
2. Koop knop → Plug&Pay NL checkout
3. Na betaling → szinn.ai/intake/
4. Intake stuurt data naar Google Sheets (language: nl)
5. Enormail triggert NL email flow

### Engelse flow  
1. szinn.ai/en → EN homepage
2. Buy button → Plug&Pay EN checkout
3. After payment → szinn.ai/intake/en/
4. Intake sends data to Google Sheets (language: en)
5. Enormail triggers EN email flow

## Plug&Pay instellingen
- Redirect na betaling NL: `https://szinn.ai/intake/`
- Redirect na betaling EN: `https://szinn.ai/intake/en/`

## Google Apps Script (intakes)
URL: zie intakeformulieren (APPS_SCRIPT_URL)
Sheet ID: 1hyDFi9QmOjaIzxlCzw-FXEv7kbm5SJ3cKOz5q9Xn2QM
