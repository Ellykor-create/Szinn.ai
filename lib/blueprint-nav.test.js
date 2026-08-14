'use strict';
// Zelfcontrole: node lib/blueprint-nav.test.js
const assert = require('assert');
const { upgradeNav } = require('./blueprint-nav');

const OLD = '<html><head><style>nav{}</style></head><body><nav>' +
  '<a class="nav-l">SZINN</a><div class="nav-links"><a class="nav-link">Visie</a></div>' +
  '<span class="nav-date">2026</span></nav></body></html>';

const up = upgradeNav(OLD);
// Checkbox + label staan vóór .nav-links, anders werken de +/~ selectors niet.
assert.ok(/<input[^>]+class="nav-toggle"[^>]*><label[^>]+class="nav-burger"[^>]*>[^<]*<\/label><div class="nav-links">/.test(up));
assert.ok(up.includes('.nav-toggle:checked~.nav-links{display:grid}'));
assert.ok(up.includes('@media print'));
// Idempotent: tweede keer verandert niets meer.
assert.strictEqual(upgradeNav(up), up);
// Nieuwe blueprints (template heeft het burgermenu al) blijven ongemoeid.
const NEW = OLD.replace('<div class="nav-links">', '<label class="nav-burger">x</label><div class="nav-links">');
assert.strictEqual(upgradeNav(NEW), NEW);
// Geen HTML-string: ongewijzigd terug.
assert.strictEqual(upgradeNav(null), null);

console.log('blueprint-nav: ok');
