import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { loadConfig, getAllConfigs, saveConfig, clearConfigCache } from '../core/configLoader.js';
import { getDb } from '../db/db.js';

const router = Router();

const INDUSTRY_PRESETS = {
  logistics: {
    parser: { vertical: 'logistics', docTypes: ['bill_of_lading', 'rate_confirmation', 'invoice', 'pod'], keywords: ['freight', 'shipment', 'load', 'carrier', 'dispatch', 'transit'] },
    hubspot: { stages: { new_lead: 'new_lead', qualified: 'qualified', rfq_sent: 'rfq_sent', negotiation: 'negotiation', closed_won: 'closed_won', closed_lost: 'closed_lost' } },
    leadScoring: { weights: { company_size: 15, title_seniority: 25, interaction_count: 20, deal_urgency: 25, freight_volume: 15 } },
    voice: {
      scripts: { outbound: 'Hi, this is {agentName} calling on behalf of {companyName}. We noticed you were interested in our freight solutions. Is this a good time to talk?', inbound: 'Thank you for calling {companyName}. I\'m {agentName}, how can I help you with your shipping needs today?' },
      qualificationQuestions: ['What type of freight are you shipping?', 'What are your typical lane origins and destinations?', 'What\'s your approximate monthly shipping volume?', 'Are you currently working with a broker or carrier?', 'What\'s your timeline for getting set up?']
    }
  },
  manufacturing: {
    parser: { vertical: 'manufacturing', docTypes: ['rfq', 'purchase_order', 'invoice', 'spec_sheet'], keywords: ['production', 'components', 'assembly', 'manufacturing', 'supply chain', 'procurement'] },
    hubspot: { stages: { new_lead: 'new_lead', discovery: 'discovery', proposal: 'proposal', negotiation: 'negotiation', contract: 'contract', closed_won: 'closed_won', closed_lost: 'closed_lost' } },
    leadScoring: { weights: { company_size: 20, title_seniority: 30, interaction_count: 15, deal_urgency: 20, annual_volume: 15 } },
    voice: {
      scripts: { outbound: 'Hi, I\'m {agentName} from {companyName}. We help manufacturers streamline procurement. Do you have a few minutes?', inbound: 'Thanks for reaching out to {companyName}. I\'m {agentName}, how can I help with your manufacturing needs?' },
      qualificationQuestions: ['What types of components or materials are you sourcing?', 'What\'s your annual procurement budget?', 'Are you looking to reduce costs or improve lead times?', 'What ERP system are you currently using?']
    }
  },
  services: {
    parser: { vertical: 'services', docTypes: ['proposal', 'contract', 'invoice', 'sow'], keywords: ['consulting', 'services', 'project', 'retainer', 'implementation', 'support'] },
    hubspot: { stages: { new_lead: 'new_lead', qualified: 'qualified', proposal: 'proposal', negotiation: 'negotiation', closed_won: 'closed_won', closed_lost: 'closed_lost' } },
    leadScoring: { weights: { company_size: 20, title_seniority: 30, interaction_count: 20, deal_urgency: 15, budget_confirmed: 15 } },
    voice: {
      scripts: { outbound: 'Hi, this is {agentName} from {companyName}. We help businesses like yours with {serviceType}. Got a quick minute?', inbound: 'Thank you for calling {companyName}. I\'m {agentName}, how can I assist you today?' },
      qualificationQuestions: ['What business challenge are you trying to solve?', 'Have you worked with consultants before?', 'What\'s your expected timeline and budget?', 'Who else is involved in the decision?']
    }
  },
  real_estate: {
    parser: { vertical: 'services', docTypes: ['listing', 'contract', 'offer', 'inspection'], keywords: ['property', 'listing', 'buyer', 'seller', 'closing', 'mortgage', 'escrow'] },
    hubspot: { stages: { new_lead: 'new_lead', showing: 'showing', offer: 'offer', under_contract: 'under_contract', closed: 'closed_won', dead: 'closed_lost' } },
    leadScoring: { weights: { company_size: 10, title_seniority: 20, interaction_count: 30, deal_urgency: 30, budget_confirmed: 10 } },
    voice: {
      scripts: { outbound: 'Hi, I\'m {agentName} with {companyName}. You recently inquired about a property — are you still in the market?', inbound: 'Thank you for calling {companyName}! I\'m {agentName}, are you looking to buy, sell, or invest?' },
      qualificationQuestions: ['Are you looking to buy, sell, or both?', 'What\'s your target price range?', 'Are you pre-approved for financing?', 'What neighborhoods or areas are you considering?', 'What\'s your timeline?']
    }
  }
};

// GET /onboarding/presets — available industry presets
router.get('/presets', (req, res) => {
  res.json({
    industries: Object.keys(INDUSTRY_PRESETS),
    presets: Object.fromEntries(
      Object.entries(INDUSTRY_PRESETS).map(([k, v]) => [k, {
        stages: Object.keys(v.hubspot.stages),
        docTypes: v.parser.docTypes,
        qualificationQuestions: v.voice.qualificationQuestions
      }])
    )
  });
});

// POST /onboarding/tenant — create a new tenant configuration
router.post('/tenant', (req, res) => {
  try {
    const {
      clientId,
      name,
      industry,
      ownerEmail,
      hubspotAccessToken,
      vapiPhoneNumber,
      slackChannelId,
      primaryColor = '#6366f1',
      logoUrl,
      customStages,
      enabledIntegrations = {}
    } = req.body;

    if (!clientId || !name || !industry) {
      return res.status(400).json({ error: 'clientId, name, and industry are required' });
    }

    if (!/^[a-z0-9_]+$/.test(clientId)) {
      return res.status(400).json({ error: 'clientId must be lowercase alphanumeric with underscores only' });
    }

    const preset = INDUSTRY_PRESETS[industry] || INDUSTRY_PRESETS.services;

    const config = {
      clientId,
      name,
      industry,
      hubspot: {
        accessToken: hubspotAccessToken ? hubspotAccessToken : '${HUBSPOT_ACCESS_TOKEN}',
        pipelineId: 'default',
        stages: customStages || preset.hubspot.stages,
        customFields: {},
        ownerEmail: ownerEmail || ''
      },
      parser: { ...preset.parser },
      voice: {
        ...preset.voice,
        phoneNumber: vapiPhoneNumber || '',
        agentName: `${name} Assistant`,
        companyName: name
      },
      integrations: {
        hubspot: true,
        slack: !!enabledIntegrations.slack,
        twilio: !!enabledIntegrations.twilio,
        calendly: !!enabledIntegrations.calendly,
        stripe: !!enabledIntegrations.stripe,
        docusign: !!enabledIntegrations.docusign,
        gmail: !!enabledIntegrations.gmail,
        ...enabledIntegrations
      },
      sms: {
        templates: {
          follow_up: 'Hi {name}, this is {agentName} from {companyName}. Just following up on your inquiry — any questions I can answer?',
          meeting_reminder: 'Reminder: You have a meeting with {companyName} tomorrow at {time}. Reply CONFIRM or CANCEL.',
          re_engagement: 'Hi {name}, it\'s been a while! {companyName} has some updates that might interest you. Worth a quick chat?'
        }
      },
      reporting: {
        weeklyEmailEnabled: !!ownerEmail,
        weeklyEmailRecipient: ownerEmail || '',
        timezone: 'America/Chicago'
      },
      leadScoring: { ...preset.leadScoring },
      branding: {
        primaryColor,
        logoUrl: logoUrl || '',
        companyName: name
      }
    };

    saveConfig(clientId, config);

    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO tenants (id, name, industry, branding_primary_color, branding_logo_url, branding_company_name) VALUES (?,?,?,?,?,?)`).run(
      clientId, name, industry, primaryColor, logoUrl || null, name
    );

    res.status(201).json({ clientId, message: 'Tenant created successfully', config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /onboarding/tenant/:clientId — update tenant config fields
router.patch('/tenant/:clientId', (req, res) => {
  try {
    const existing = loadConfig(req.params.clientId);
    const updates = req.body;

    // Deep merge
    const merged = deepMerge(existing, updates);
    saveConfig(req.params.clientId, merged);

    const db = getDb();
    if (updates.name || updates.industry || updates.branding) {
      db.prepare(`UPDATE tenants SET name=?, industry=?, updated_at=datetime('now') WHERE id=?`).run(
        merged.name, merged.industry, req.params.clientId
      );
    }

    res.json({ clientId: req.params.clientId, message: 'Config updated', config: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /onboarding/checklist/:clientId — setup progress checklist
router.get('/checklist/:clientId', (req, res) => {
  try {
    const config = loadConfig(req.params.clientId);
    const db = getDb();

    const hasContacts = db.prepare(`SELECT COUNT(*) as n FROM contacts_cache WHERE client_id=?`).get(req.params.clientId).n > 0;
    const hasDeals = db.prepare(`SELECT COUNT(*) as n FROM deals_cache WHERE client_id=?`).get(req.params.clientId).n > 0;
    const hasCalls = db.prepare(`SELECT COUNT(*) as n FROM call_logs WHERE client_id=?`).get(req.params.clientId).n > 0;
    const hasParses = db.prepare(`SELECT COUNT(*) as n FROM parse_jobs WHERE client_id=?`).get(req.params.clientId).n > 0;

    const checklist = [
      { id: 'config', label: 'Client config created', done: true },
      { id: 'hubspot', label: 'HubSpot connected', done: !config.hubspot.accessToken.includes('${') },
      { id: 'contacts', label: 'First contact imported', done: hasContacts },
      { id: 'deals', label: 'First deal in pipeline', done: hasDeals },
      { id: 'parser', label: 'Parser tested', done: hasParses },
      { id: 'voice', label: 'Voice agent called', done: hasCalls },
      { id: 'slack', label: 'Slack alerts configured', done: config.integrations?.slack && !!process.env.SLACK_BOT_TOKEN },
      { id: 'reporting', label: 'Weekly reports enabled', done: config.reporting?.weeklyEmailEnabled && !!config.reporting?.weeklyEmailRecipient },
    ];

    const completedCount = checklist.filter(c => c.done).length;
    res.json({ clientId: req.params.clientId, progress: `${completedCount}/${checklist.length}`, checklist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default router;
