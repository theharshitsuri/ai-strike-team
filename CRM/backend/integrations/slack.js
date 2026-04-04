import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/db.js';
import { createContact, searchContacts, updateContact, updateDealStage } from '../core/hubspot.js';

const MOCK = process.env.MOCK_MODE === 'true';

/**
 * Post a Slack alert to the configured channel.
 */
export async function postSlackAlert(config, message) {
  const db = getDb();

  if (MOCK || !process.env.SLACK_BOT_TOKEN) {
    console.log(`[Slack MOCK] ${config.clientId}: ${message}`);
    return { ok: true, mock: true };
  }

  const res = await axios.post('https://slack.com/api/chat.postMessage', {
    channel: process.env.SLACK_CHANNEL_ID,
    text: message
  }, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' }
  });

  return res.data;
}

/**
 * Send a rich Slack block message for deal stage changes.
 */
export async function postDealAlert(config, deal, newStage) {
  const emoji = { closed_won: '🏆', qualified: '✅', proposal: '📋', negotiation: '🤝', closed_lost: '❌' }[newStage] || '📊';
  const message = `${emoji} *Deal Stage Update* — ${config.name}\n>*${deal.properties?.dealname || 'Deal'}* moved to: *${newStage.replace(/_/g, ' ').toUpperCase()}*\n>Amount: $${(deal.properties?.amount || 0).toLocaleString()}`;
  return postSlackAlert(config, message);
}

/**
 * Handle Calendly webhook — meeting booked → create/update HubSpot contact + activity.
 */
export async function handleCalendlyWebhook(config, payload) {
  const db = getDb();
  const { event, payload: data } = payload;

  if (event !== 'invitee.created') return { ignored: true };

  const invitee = data?.invitee;
  const eventTime = data?.scheduled_event?.start_time;
  let hubspotContactId = null;

  // Sync to HubSpot: upsert contact
  if (invitee?.email) {
    try {
      const existing = await searchContacts(config, invitee.email);
      const nameParts = (invitee.name || '').split(' ');
      const fields = {
        firstname: nameParts[0] || 'Unknown',
        lastname: nameParts.slice(1).join(' ') || '',
        email: invitee.email,
        hs_lead_status: 'IN_PROGRESS'
      };

      if (existing?.results?.length > 0) {
        hubspotContactId = existing.results[0].id;
        await updateContact(config, hubspotContactId, fields);
      } else {
        const created = await createContact(config, fields);
        hubspotContactId = created.id;
      }

      // Mirror to local cache
      db.prepare(`INSERT OR REPLACE INTO contacts_cache
        (id, client_id, hubspot_id, firstname, lastname, email, lead_status, source, last_activity_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).run(
        hubspotContactId, config.clientId, hubspotContactId,
        fields.firstname, fields.lastname, invitee.email, 'IN_PROGRESS', 'calendly');
    } catch (e) {
      console.error('[Calendly→HubSpot] Contact sync error:', e.message);
    }
  }

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_id, contact_name, metadata) VALUES (?,?,?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'meeting_booked',
    `Meeting booked: ${invitee?.name || 'Unknown'}`,
    `Scheduled for ${eventTime ? new Date(eventTime).toLocaleString() : 'TBD'}`,
    hubspotContactId, invitee?.name || null,
    JSON.stringify({ email: invitee?.email, eventTime, uri: data?.uri, hubspotContactId })
  );

  if (config.integrations?.slack) {
    await postSlackAlert(config, `📅 *New Meeting Booked!*\n>${invitee?.name} (${invitee?.email})\nTime: ${eventTime ? new Date(eventTime).toLocaleString() : 'TBD'}`);
  }

  return { processed: true, invitee: invitee?.name, time: eventTime, hubspotContactId };
}

/**
 * Handle Stripe payment webhook — mark contact as customer in HubSpot + close deal.
 */
export async function handleStripePayment(config, payload) {
  const db = getDb();
  const amount = ((payload.amount || 0) / 100).toFixed(2);
  const customerEmail = payload.customer_email || payload.receipt_email;
  let hubspotContactId = null;

  // Sync to HubSpot: mark contact as Customer
  if (customerEmail) {
    try {
      const existing = await searchContacts(config, customerEmail);
      if (existing?.results?.length > 0) {
        hubspotContactId = existing.results[0].id;
        await updateContact(config, hubspotContactId, {
          hs_lead_status: 'CUSTOMER',
          lifecyclestage: 'customer'
        });
      }
    } catch (e) {
      console.error('[Stripe→HubSpot] Contact update error:', e.message);
    }
  }

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_id, metadata) VALUES (?,?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'payment_received',
    `Payment received: $${amount}`,
    `Customer: ${customerEmail || 'unknown'}`,
    hubspotContactId,
    JSON.stringify({ amount, customerEmail, paymentId: payload.id, hubspotContactId })
  );

  if (config.integrations?.slack) {
    await postSlackAlert(config, `💰 *Payment Received!*\n>Amount: $${amount}\n>Customer: ${customerEmail || 'unknown'}`);
  }

  return { processed: true, amount, customerEmail, hubspotContactId };
}

/**
 * Handle DocuSign webhook — envelope status change → update deal + activity.
 */
export async function handleDocuSignWebhook(config, payload) {
  const db = getDb();
  const envelopeId = payload.envelopeId || payload.data?.envelopeId;
  const status = payload.status || payload.data?.envelopeSummary?.status;
  const signerEmail = payload.data?.envelopeSummary?.recipients?.signers?.[0]?.email;
  const signerName = payload.data?.envelopeSummary?.recipients?.signers?.[0]?.name;
  const docName = payload.data?.envelopeSummary?.emailSubject || 'Document';

  // Update document record if tracked
  const docRecord = db.prepare(`SELECT * FROM documents WHERE docusign_envelope_id=? AND client_id=?`).get(envelopeId, config.clientId);

  if (docRecord) {
    db.prepare(`UPDATE documents SET status=?, signer_name=?, signer_email=?, signed_at=? WHERE id=?`).run(
      status, signerName, signerEmail, status === 'completed' ? new Date().toISOString() : null, docRecord.id
    );

    // If contract signed → advance deal stage to "contract" or "closed_won"
    if (status === 'completed' && docRecord.deal_id) {
      const targetStage = docRecord.type === 'contract' ? 'closed_won' : 'contract';
      try {
        await updateDealStage(config, docRecord.deal_id, targetStage);
      } catch (e) {
        console.error('[DocuSign→HubSpot] Deal stage update error:', e.message);
      }
    }
  } else {
    // Create a new tracking record
    db.prepare(`INSERT INTO documents (id, client_id, docusign_envelope_id, type, status, signer_name, signer_email, document_name, signed_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      uuid(), config.clientId, envelopeId, 'contract', status,
      signerName, signerEmail, docName,
      status === 'completed' ? new Date().toISOString() : null
    );
  }

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, metadata) VALUES (?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'document_signed',
    `Document ${status}: ${docName}`,
    `Signer: ${signerName || signerEmail || 'unknown'}`,
    JSON.stringify({ envelopeId, status, signerEmail })
  );

  if (config.integrations?.slack) {
    const emoji = status === 'completed' ? '✍️' : '📋';
    await postSlackAlert(config, `${emoji} *DocuSign ${status}:* ${docName}\n>Signer: ${signerName || signerEmail || 'unknown'}`);
  }

  return { processed: true, envelopeId, status };
}
