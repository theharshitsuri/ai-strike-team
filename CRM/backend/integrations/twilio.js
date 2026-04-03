import twilio from 'twilio';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/db.js';

const MOCK = process.env.MOCK_MODE === 'true';

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Send an SMS message to a contact.
 */
export async function sendSms(config, toPhone, templateKey, variables = {}) {
  const template = config.sms?.templates?.[templateKey] || 'Hello from {company}!';
  const body = interpolate(template, { company: config.name, phone: config.hubspot?.ownerEmail, ...variables });

  if (MOCK) {
    const logId = uuid();
    getDb().prepare(`INSERT INTO sms_logs (id, client_id, direction, contact_phone, contact_name, message_body, status) VALUES (?,?,?,?,?,?,?)`).run(
      logId, config.clientId, 'outbound', toPhone, variables.name || 'Contact', body, 'sent'
    );
    return { sid: `SM_mock_${uuid().slice(0, 8)}`, status: 'sent', body, logId };
  }

  const client = getClient();
  const message = await client.messages.create({
    body,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to: toPhone
  });

  getDb().prepare(`INSERT INTO sms_logs (id, client_id, direction, contact_phone, contact_name, message_body, twilio_sid, status) VALUES (?,?,?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'outbound', toPhone, variables.name || '', body, message.sid, message.status
  );

  return message;
}

/**
 * Handle inbound SMS reply (Twilio webhook).
 */
export async function handleInboundSms(config, fromPhone, messageBody) {
  const db = getDb();

  db.prepare(`INSERT INTO sms_logs (id, client_id, direction, contact_phone, message_body, status) VALUES (?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'inbound', fromPhone, messageBody, 'received'
  );

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, metadata) VALUES (?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'sms_received',
    `SMS reply from ${fromPhone}`,
    messageBody.slice(0, 100),
    JSON.stringify({ phone: fromPhone })
  );

  // Auto-reply logic
  const lower = messageBody.toLowerCase();
  if (lower.includes('stop') || lower.includes('unsubscribe')) {
    return { action: 'opted_out', response: 'You have been unsubscribed. Reply START to re-subscribe.' };
  }
  if (lower.includes('yes') || lower.includes('interested') || lower.includes('call me')) {
    return { action: 'interested', response: 'Great! Someone from our team will reach out within 24 hours.' };
  }

  return { action: 'logged', response: null };
}

/**
 * Run a bulk SMS campaign for a list of contacts.
 */
export async function runSmsCampaign(config, contacts, templateKey) {
  const results = [];
  for (const contact of contacts) {
    try {
      const msg = await sendSms(config, contact.phone, templateKey, {
        name: contact.name,
        origin: contact.origin,
        destination: contact.destination,
        load_type: contact.load_type,
        calendly_link: 'https://calendly.com/yourlink'
      });
      results.push({ contactId: contact.id, status: 'sent', sid: msg.sid });
    } catch (err) {
      results.push({ contactId: contact.id, status: 'failed', error: err.message });
    }
  }

  return { total: contacts.length, sent: results.filter(r => r.status === 'sent').length, results };
}

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}
