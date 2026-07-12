'use strict';
// Ingeplande functie: verstuurt cadeau-e-mails waarvan de verzenddatum bereikt
// is. Draait dagelijks (schema in netlify.toml). Idempotent: alleen 'pending'
// cadeaus met send_date <= vandaag worden verstuurd en daarna op 'sent' gezet.

const { loadDB, saveDB } = require('../../lib/db');
const { sendGiftEmail } = require('../../lib/email');

function isDue(sendDate) {
  if (!sendDate) return true;
  return sendDate <= new Date().toISOString().slice(0, 10);
}

exports.handler = async () => {
  const db = await loadDB();
  const due = (db.giftCodes || []).filter(g => g.status === 'pending' && isDue(g.send_date));
  let sent = 0;
  for (const g of due) {
    try {
      const sender = db.users.find(u => u.id === g.owner_user_id);
      await sendGiftEmail({
        to: g.recipient_email, recipientName: g.recipient_name,
        senderName: sender && sender.name, giftCode: g.code,
        personalMessage: g.message, lang: g.lang,
      });
      g.status = 'sent';
      g.sent_at = new Date().toISOString();
      sent++;
    } catch (err) {
      console.error(`cadeau ${g.code} versturen mislukt:`, err.message);
    }
  }
  if (sent) await saveDB(db);
  console.log(`process-gifts: ${sent} cadeau(s) verstuurd van ${due.length} klaarstaande.`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};
