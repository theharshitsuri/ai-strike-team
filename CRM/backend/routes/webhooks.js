import { Router } from 'express';
import { loadConfig } from '../core/configLoader.js';
import { handleCallEnded } from '../voice/outboundCampaign.js';
import { handleCalendlyWebhook, handleStripePayment, postDealAlert } from '../integrations/slack.js';
import { parseEmail } from '../parser/emailParser.js';
import { getDb } from '../db/db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// POST /webhook/vapi — Vapi call events
router.post('/vapi', async (req, res) => {
  // Acknowledge immediately (Vapi requires fast response)
  res.status(204).send();

  try {
    const config = loadConfig(req.clientId);
    const { message } = req.body;
    if (!message) return;

    if (message.type === 'end-of-call-report') {
      await handleCallEnded(config, {
        id: message.call?.id,
        transcript: message.transcript,
        summary: message.summary,
        duration: message.call?.duration,
        customer: message.call?.customer,
        metadata: message.call?.metadata
      });
    }
  } catch (err) {
    console.error('[Webhook/Vapi] Error:', err.message);
  }
});

// POST /webhook/hubspot — HubSpot deal stage change events
router.post('/hubspot', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      if (event.subscriptionType === 'deal.propertyChange' && event.propertyName === 'dealstage') {
        const db = getDb();
        db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, deal_id, metadata) VALUES (?,?,?,?,?,?,?)`).run(
          uuid(), config.clientId, 'deal_stage_change',
          `Deal stage changed`,
          `New stage: ${event.propertyValue}`,
          event.objectId?.toString(),
          JSON.stringify(event)
        );

        // Slack alert
        if (config.integrations?.slack) {
          await postDealAlert(config, { id: event.objectId, properties: { dealname: event.dealname || 'Deal', amount: 0 } }, event.propertyValue);
        }
      }
    }
  } catch (err) {
    console.error('[Webhook/HubSpot] Error:', err.message);
  }
});

// POST /webhook/gmail — Gmail Pub/Sub push
router.post('/gmail', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    const { message } = req.body;
    if (!message?.data) return;

    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);

    // In production: use Gmail API to fetch the actual email content
    // Here we simulate with the notification data
    if (payload.emailAddress) {
      const mockEmail = `From: ${payload.emailAddress}\nReceived at: ${new Date().toISOString()}\nThis is an automated notification about a new email in the monitored inbox.`;
      await parseEmail(config, mockEmail, { source: 'gmail', senderEmail: payload.emailAddress });
    }
  } catch (err) {
    console.error('[Webhook/Gmail] Error:', err.message);
  }
});

// POST /webhook/calendly — Calendly booking events
router.post('/calendly', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    await handleCalendlyWebhook(config, req.body);
  } catch (err) {
    console.error('[Webhook/Calendly] Error:', err.message);
  }
});

// POST /webhook/stripe — Stripe payment events
router.post('/stripe', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    if (req.body.type === 'payment_intent.succeeded') {
      await handleStripePayment(config, req.body.data?.object || {});
    }
  } catch (err) {
    console.error('[Webhook/Stripe] Error:', err.message);
  }
});

// POST /webhook/twilio/sms — Inbound SMS replies
router.post('/twilio/sms', async (req, res) => {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) return res.status(400).send();

    const config = loadConfig(req.clientId);
    const { handleInboundSms } = await import('../integrations/twilio.js');
    const result = await handleInboundSms(config, From, Body);

    // TwiML response
    const twiml = result.response
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${result.response}</Message></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

    res.set('Content-Type', 'text/xml').send(twiml);
  } catch (err) {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
});

export default router;
