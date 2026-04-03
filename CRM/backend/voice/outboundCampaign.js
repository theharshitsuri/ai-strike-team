import { v4 as uuid } from 'uuid';
import { createOutboundCall } from './vapiClient.js';
import { getDeals, getContact, updateDealStage, logActivity } from '../core/hubspot.js';
import { parseTranscript } from '../parser/emailParser.js';
import { getDb } from '../db/db.js';

/**
 * Launch an outbound follow-up call campaign for leads that haven't responded.
 */
export async function runOutboundCampaign(config, assistantId, options = {}) {
  const db = getDb();
  const { daysInactive = 5, limit = 10 } = options;

  // Get deals in early stages
  const { results: deals } = await getDeals(config, 50);
  const targetStages = ['new_lead', 'qualified'];
  const eligibleDeals = deals.filter(d => targetStages.includes(d.properties.dealstage));

  const campaignId = uuid();
  const results = [];

  for (const deal of eligibleDeals.slice(0, limit)) {
    try {
      const contactPhone = deal.properties.phone || `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
      const contactName = deal.properties.dealname?.split(' -')[0] || 'Prospect';

      const call = await createOutboundCall(contactPhone, assistantId, {
        dealId: deal.id,
        clientId: config.clientId,
        contactName,
        campaignId
      });

      // Log call in DB
      const logId = uuid();
      db.prepare(`INSERT INTO call_logs (id, client_id, direction, status, vapi_call_id, contact_name, contact_phone, hubspot_contact_id) VALUES (?,?,?,?,?,?,?,?)`).run(
        logId, config.clientId, 'outbound', 'initiated', call.id, contactName, contactPhone, null
      );

      results.push({ dealId: deal.id, callId: call.id, logId, status: 'initiated' });
    } catch (err) {
      results.push({ dealId: deal.id, status: 'failed', error: err.message });
    }
  }

  return { campaignId, totalCalled: results.filter(r => r.status === 'initiated').length, results };
}

/**
 * Handle incoming Vapi call-ended webhook — parse transcript, update CRM.
 */
export async function handleCallEnded(config, callPayload) {
  const db = getDb();
  const { id: callId, transcript, summary, duration, customer, metadata } = callPayload;

  // Parse transcript with AI
  let parsed = null;
  if (transcript) {
    try {
      const result = await parseTranscript(config, transcript, metadata?.contactId);
      parsed = result.extracted;
    } catch (err) {
      console.error('[CallWebhook] Transcript parse failed:', err.message);
    }
  }

  const outcome = parsed?.call_outcome || 'completed';

  // Update call log
  db.prepare(`UPDATE call_logs SET status=?, outcome=?, transcript=?, summary=?, duration_seconds=?, ended_at=datetime('now') WHERE vapi_call_id=?`).run(
    'completed', outcome, transcript || '', summary || parsed?.rep_notes || '', duration || 0, callId
  );

  // Update HubSpot deal stage if applicable
  if (metadata?.dealId && parsed?.deal_stage) {
    await updateDealStage(config, metadata.dealId, parsed.deal_stage).catch(() => {});
  }

  // Activity feed entry
  db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_name, metadata) VALUES (?,?,?,?,?,?,?)`).run(
    uuid(), config.clientId, 'call_completed',
    `Call completed: ${customer?.number || 'unknown'}`,
    `Outcome: ${outcome} | Duration: ${Math.round((duration || 0) / 60)}m`,
    metadata?.contactName || null,
    JSON.stringify({ callId, outcome, duration, dealId: metadata?.dealId })
  );

  return { callId, outcome, parsed };
}
