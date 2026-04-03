import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/db.js';

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
 * Handle Calendly webhook — meeting booked → update CRM.
 */
export async function handleCalendlyWebhook(config, payload) {
  const db = getDb();
  const { event, payload: data } = payload;

  if (event !== 'invitee.created') return { ignored: true };

  const invitee = data?.invitee;
  const eventTime = data?.scheduled_event?.start_time;

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_name, metadata) VALUES (?,?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'meeting_booked',
    `Meeting booked: ${invitee?.name || 'Unknown'}`,
    `Scheduled for ${eventTime ? new Date(eventTime).toLocaleString() : 'TBD'}`,
    invitee?.name || null,
    JSON.stringify({ email: invitee?.email, eventTime, uri: data?.uri })
  );

  // Notify via Slack
  if (config.integrations?.slack) {
    await postSlackAlert(config, `📅 *New Meeting Booked!*\n>${invitee?.name} (${invitee?.email})\nTime: ${eventTime ? new Date(eventTime).toLocaleString() : 'TBD'}`);
  }

  return { processed: true, invitee: invitee?.name, time: eventTime };
}

/**
 * Handle Stripe payment webhook — mark contact as customer in CRM.
 */
export async function handleStripePayment(config, payload) {
  const db = getDb();
  const amount = (payload.amount / 100).toFixed(2);
  const customerEmail = payload.customer_email || payload.receipt_email;

  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, metadata) VALUES (?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'payment_received',
    `Payment received: $${amount}`,
    `Customer: ${customerEmail || 'unknown'}`,
    JSON.stringify({ amount, customerEmail, paymentId: payload.id })
  );

  if (config.integrations?.slack) {
    await postSlackAlert(config, `💰 *Payment Received!*\n>Amount: $${amount}\n>Customer: ${customerEmail || 'unknown'}`);
  }

  return { processed: true, amount, customerEmail };
}
