'use strict';
// Vastgelopen-check: welke orders hebben nog een lopende run op GitHub.
// Draai: node lib/kit-worker.test.js
const assert = require('assert');
const kit = require('./kit-worker');

global.fetch = async () => ({ ok: true, json: async () => ({ workflow_runs: [
  { status: 'in_progress', display_title: 'blueprint · ORD-A' },
  { status: 'queued', display_title: 'rug 12 mm · ORD-B' },
  { status: 'completed', display_title: 'blueprint · ORD-C' },
] }) });

kit.activeRunOrders().then(s => {
  assert.deepStrictEqual([...s].sort(), ['ORD-A', 'ORD-B']);
  console.log('ok');
});
