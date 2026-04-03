import { Router } from 'express';
import { loadConfig } from '../core/configLoader.js';
import { createOutboundCall, listCalls, getCallDetails, createAssistant } from '../voice/vapiClient.js';
import { runOutboundCampaign } from '../voice/outboundCampaign.js';
import { getDb } from '../db/db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /voice/calls — list all call logs
router.get('/calls', (req, res) => {
  try {
    const db = getDb();
    const calls = db.prepare(`SELECT * FROM call_logs WHERE client_id=? ORDER BY created_at DESC LIMIT 50`).all(req.clientId);
    res.json({ calls, total: calls.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /voice/calls/:id — single call detail
router.get('/calls/:id', async (req, res) => {
  try {
    const db = getDb();
    const log = db.prepare(`SELECT * FROM call_logs WHERE id=? AND client_id=?`).get(req.params.id, req.clientId);
    if (!log) return res.status(404).json({ error: 'Call not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /voice/call — trigger a single outbound call
router.post('/call', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { phoneNumber, contactName, dealId, scriptType = 'outbound' } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

    const call = await createOutboundCall(phoneNumber, 'default_assistant', { dealId, contactName, clientId: req.clientId });

    const logId = uuid();
    getDb().prepare(`INSERT INTO call_logs (id, client_id, direction, status, vapi_call_id, contact_name, contact_phone) VALUES (?,?,?,?,?,?,?)`).run(
      logId, req.clientId, 'outbound', 'initiated', call.id, contactName || '', phoneNumber
    );

    res.json({ callId: call.id, logId, status: 'initiated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /voice/campaign — run outbound campaign
router.post('/campaign', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { daysInactive = 5, limit = 10 } = req.body;
    const result = await runOutboundCampaign(config, 'default_assistant', { daysInactive, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /voice/assistant — create a Vapi assistant for this client
router.post('/assistant', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { scriptType = 'inbound' } = req.body;
    const assistant = await createAssistant(config, scriptType);
    res.json(assistant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /voice/stats — call statistics summary
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN direction='inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction='outbound' THEN 1 ELSE 0 END) as outbound,
        SUM(CASE WHEN outcome='qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN outcome='meeting_booked' THEN 1 ELSE 0 END) as meetings_booked,
        AVG(duration_seconds) as avg_duration_seconds
      FROM call_logs WHERE client_id=?
    `).get(req.clientId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
