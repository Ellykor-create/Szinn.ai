'use strict';
// Cadeau-aflevering. Nieuwe flow: de koper betaalt, vult stap 1 van de intake in
// voor de ontvanger, de blueprint wordt direct gemaakt, maar de klaar-mail (met
// inloggegevens) gaat pas op de gekozen verzenddatum naar de ontvanger.
// Gedeeld door de worker-callback (api.js), lib/pipeline.js, de ingeplande
// functie process-gifts en /api/gift/process.
//
// gift.status: 'awaiting_intake' (betaald, stap 1 nog niet ingevuld) →
//              'pending' (order loopt/klaar, wacht op datum) → 'sent'.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendReadyEmail, sendGiftEmail } = require('./email');

const isDue = (sendDate) => !sendDate || sendDate <= new Date().toISOString().slice(0, 10);

function giftFor(db, order) {
  if (!order || !order.gift_code) return null;
  return (db.giftCodes || []).find(g => g.code === order.gift_code) || null;
}

// Wat de klaar-mail over de gever vertelt (null = geen cadeau).
function giftInfo(db, g) {
  if (!g) return null;
  const sender = db.users.find(u => u.id === g.owner_user_id);
  return { senderName: (sender && sender.name) || null, message: g.message || null };
}

// Vers wachtwoord (zoals bij "wachtwoord vergeten"); admin logt in via ADMIN_PASSWORD.
function freshPassword(user) {
  if (!user || user.is_admin) return '';
  const password = crypto.randomBytes(5).toString('hex');
  user.password = bcrypt.hashSync(password, 10);
  return password;
}

// Alle cadeaus waarvan de datum is bereikt. Nieuwe flow: order klaar → klaar-mail
// met inloggegevens aan de ontvanger; nog niet klaar → morgen opnieuw. Oude flow
// (code-cadeaus zonder order): de code-mail. Muteert db; geeft aantal verstuurd.
async function processDueGifts(db) {
  let sent = 0;
  const due = (db.giftCodes || []).filter(g => g.status === 'pending' && isDue(g.send_date));
  for (const g of due) {
    try {
      if (g.order_id) {
        const order = db.orders.find(o => o.id === g.order_id);
        if (!order || order.status !== 'completed') { console.log(`cadeau ${g.code}: blueprint nog niet klaar, morgen opnieuw`); continue; }
        const user = db.users.find(u => u.id === order.user_id);
        if (!user) { console.error(`cadeau ${g.code}: ontvanger-account ontbreekt`); continue; }
        await sendReadyEmail({
          to: user.email, name: order.client_name || user.name, orderId: order.id,
          lang: order.blueprint_language === 'en' ? 'en' : 'nl', personal: order.ready_mail_personal || '',
          password: freshPassword(user), gift: giftInfo(db, g),
        });
      } else {
        if (!g.recipient_email) continue;
        const sender = db.users.find(u => u.id === g.owner_user_id);
        await sendGiftEmail({ to: g.recipient_email, recipientName: g.recipient_name, senderName: sender && sender.name, giftCode: g.code, personalMessage: g.message, lang: g.lang });
      }
      g.status = 'sent'; g.sent_at = new Date().toISOString(); sent++;
    } catch (err) { console.error(`cadeau ${g.code} versturen mislukt:`, err.message); }
  }
  return sent;
}

module.exports = { isDue, giftFor, giftInfo, freshPassword, processDueGifts };
