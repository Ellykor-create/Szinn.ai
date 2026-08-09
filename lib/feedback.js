'use strict';
// Gedeelde validatie voor het feedbackformulier (server.js én netlify/functions/api.js),
// zelfde opzet als lib/journal.js.

const MAX_MESSAGE = 2000;

// Valideert/normaliseert een feedback-inzending. Geeft { error } (per taal) of
// { name, email, rating, message, lang } terug.
function validateFeedback(body) {
  const lang = body?.lang === 'en' ? 'en' : 'nl';
  const message = String(body?.message || '').trim().slice(0, MAX_MESSAGE);
  if (!message) {
    return { error: lang === 'en' ? 'Please write a message first.' : 'Schrijf eerst een bericht.' };
  }
  let rating = parseInt(body?.rating, 10);
  if (!(rating >= 1 && rating <= 5)) rating = null;
  return {
    name: String(body?.name || '').trim().slice(0, 120) || null,
    email: String(body?.email || '').trim().slice(0, 200) || null,
    rating, message, lang,
  };
}

module.exports = { validateFeedback, MAX_MESSAGE };

// Minimale zelfcheck: node lib/feedback.js
if (require.main === module) {
  const assert = require('assert');
  assert.ok(validateFeedback({}).error);
  assert.ok(validateFeedback({ message: '   ', lang: 'en' }).error.startsWith('Please'));
  const ok = validateFeedback({ message: ' Top! ', name: 'A', rating: '5', lang: 'en' });
  assert.deepStrictEqual([ok.message, ok.rating, ok.lang], ['Top!', 5, 'en']);
  assert.strictEqual(validateFeedback({ message: 'x', rating: 9 }).rating, null);
  assert.strictEqual(validateFeedback({ message: 'x'.repeat(9000) }).message.length, 2000);
  console.log('lib/feedback.js zelfcheck OK');
}
