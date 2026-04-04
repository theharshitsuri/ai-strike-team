import { Router } from 'express';
import { loadConfig } from '../core/configLoader.js';
import { scoreContact, getNextBestAction, detectDealRisk, draftFollowUpEmail, getForecast, coachCall } from '../intelligence/leadScoring.js';
import { getDb } from '../db/db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /ai/score/:contactId — get or compute lead score
router.get('/score/:contactId', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const result = await scoreContact(config, req.params.contactId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/nba/:contactId — next best action
router.get('/nba/:contactId', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const contextData = req.query;
    const result = await getNextBestAction(config, req.params.contactId, contextData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/risk — deal risk detection across all pipeline
router.get('/risk', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const result = await detectDealRisk(config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/draft — draft a follow-up email
router.post('/draft', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { contactData, dealContext } = req.body;
    if (!contactData) return res.status(400).json({ error: 'contactData is required' });
    const result = await draftFollowUpEmail(config, contactData, dealContext || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/forecast — revenue forecast
router.get('/forecast', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const result = await getForecast(config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/coach — analyze a call transcript for coaching feedback
router.post('/coach', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { callId, transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });
    const result = await coachCall(config, callId || 'unknown', transcript);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ai/insights — all saved insights for this client
router.get('/insights', (req, res) => {
  try {
    const db = getDb();
    const insights = db.prepare(`SELECT * FROM ai_insights WHERE client_id=? ORDER BY updated_at DESC LIMIT 50`).all(req.clientId);
    res.json({ insights, total: insights.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
