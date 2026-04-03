import { Router } from 'express';
import { loadConfig, getAllConfigs, clearConfigCache } from '../core/configLoader.js';
import { getDeals, getContact, searchContacts, getPipeline } from '../core/hubspot.js';
import { scoreContact, getForecast, detectDealRisk } from '../intelligence/leadScoring.js';
import { getDb } from '../db/db.js';

const router = Router();

// GET /dashboard/overview — full dashboard summary for a client
router.get('/overview', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const db = getDb();

    const [dealsResult, forecast, riskResult] = await Promise.all([
      getDeals(config, 50),
      getForecast(config),
      detectDealRisk(config)
    ]);

    const recentActivity = db.prepare(`SELECT * FROM activity_feed WHERE client_id=? ORDER BY created_at DESC LIMIT 20`).all(req.clientId);
    const recentCalls = db.prepare(`SELECT * FROM call_logs WHERE client_id=? ORDER BY created_at DESC LIMIT 10`).all(req.clientId);
    const recentParses = db.prepare(`SELECT * FROM parse_jobs WHERE client_id=? ORDER BY created_at DESC LIMIT 10`).all(req.clientId);
    const callStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN outcome='qualified' THEN 1 ELSE 0 END) as qualified, SUM(CASE WHEN outcome='meeting_booked' THEN 1 ELSE 0 END) as meetings FROM call_logs WHERE client_id=?`).get(req.clientId);

    // Stage distribution
    const stageDistribution = {};
    for (const deal of dealsResult.results) {
      const stage = deal.properties.dealstage;
      if (!stageDistribution[stage]) stageDistribution[stage] = { count: 0, value: 0 };
      stageDistribution[stage].count++;
      stageDistribution[stage].value += parseFloat(deal.properties.amount) || 0;
    }

    res.json({
      client: { id: config.clientId, name: config.name, industry: config.industry },
      pipeline: {
        totalDeals: dealsResult.total,
        stageDistribution,
        recentDeals: dealsResult.results.slice(0, 10)
      },
      forecast,
      risk: riskResult,
      activity: recentActivity,
      calls: { stats: callStats, recent: recentCalls },
      parses: { recent: recentParses },
      integrations: config.integrations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/pipeline — kanban pipeline data
router.get('/pipeline', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { results: deals } = await getDeals(config, 100);
    const stages = config.hubspot.stages;

    // Group deals by stage
    const columns = {};
    for (const [stageName, stageId] of Object.entries(stages)) {
      columns[stageName] = {
        name: stageName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        deals: []
      };
    }

    for (const deal of deals) {
      const stage = deal.properties.dealstage;
      if (columns[stage]) {
        columns[stage].deals.push(deal);
      } else {
        // Unknown stage, put in first column
        const firstKey = Object.keys(columns)[0];
        if (firstKey) columns[firstKey].deals.push(deal);
      }
    }

    res.json({ columns, totalDeals: deals.length, stages: Object.keys(stages) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/activity — activity feed
router.get('/activity', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 30;
    const type = req.query.type;
    const query = type
      ? `SELECT * FROM activity_feed WHERE client_id=? AND type=? ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM activity_feed WHERE client_id=? ORDER BY created_at DESC LIMIT ?`;
    const args = type ? [req.clientId, type, limit] : [req.clientId, limit];
    const activities = db.prepare(query).all(...args);
    res.json({ activities, total: activities.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/clients — list all configured clients
router.get('/clients', (req, res) => {
  try {
    const configs = getAllConfigs();
    res.json(configs.map(c => ({ id: c.clientId, name: c.name, industry: c.industry, integrations: c.integrations })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /config/:clientId — get client config
router.get('/:clientId', (req, res) => {
  try {
    const config = loadConfig(req.params.clientId);
    res.json(config);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
