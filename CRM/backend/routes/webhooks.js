import { Router } from 'express';
import { loadConfig } from '../core/configLoader.js';
import { handleCallEnded } from '../voice/outboundCampaign.js';
import { handleCalendlyWebhook, handleStripePayment, handleDocuSignWebhook, postDealAlert } from '../integrations/slack.js';
import { parseEmail } from '../parser/emailParser.js';
import { getDb } from '../db/db.js';
import { v4 as uuid } from 'uuid';
import { google } from 'googleapis';

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

// POST /webhook/gmail — Gmail Pub/Sub push notification
router.post('/gmail', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    const { message } = req.body;
    if (!message?.data) return;

    const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    if (!payload.emailAddress || !payload.historyId) return;

    // Use Gmail API to fetch the actual message when credentials are available
    const hasGmailCreds = process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN;

    if (hasGmailCreds && process.env.MOCK_MODE !== 'true') {
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

      const gmail = google.gmail({ version: 'v1', auth });

      // List messages added in this history batch
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: payload.historyId,
        historyTypes: ['messageAdded']
      });

      const addedMessages = history.data.history?.flatMap(h => h.messagesAdded || []) || [];

      for (const { message: msg } of addedMessages) {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const headers = full.data.payload?.headers || [];
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const subject = getHeader('Subject');
        const date = getHeader('Date');
        const senderEmail = from.match(/<([^>]+)>/)?.[1] || from;

        // Extract plain-text body
        let body = '';
        const findText = (parts) => {
          for (const part of (parts || [])) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body += Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.parts) findText(part.parts);
          }
        };
        if (full.data.payload?.body?.data) {
          body = Buffer.from(full.data.payload.body.data, 'base64').toString('utf-8');
        } else {
          findText(full.data.payload?.parts);
        }

        const emailText = `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${body}`.slice(0, 8000);
        await parseEmail(config, emailText, { source: 'gmail', senderEmail });
      }
    } else {
      // Fallback / mock: synthesize from notification metadata
      const mockEmail = `From: ${payload.emailAddress}\nDate: ${new Date().toISOString()}\nSubject: Inbound inquiry\n\nNew email received from ${payload.emailAddress}. (Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN for real content.)`;
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

// POST /webhook/docusign — DocuSign envelope status changes
router.post('/docusign', async (req, res) => {
  res.status(204).send();
  try {
    const config = loadConfig(req.clientId);
    await handleDocuSignWebhook(config, req.body);
  } catch (err) {
    console.error('[Webhook/DocuSign] Error:', err.message);
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
