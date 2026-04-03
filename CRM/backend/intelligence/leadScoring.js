import { v4 as uuid } from 'uuid';
import { generateWithClaude } from '../core/claudeClient.js';
import { getDeals, getContact } from '../core/hubspot.js';
import { getDb } from '../db/db.js';

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

/**
 * Score a lead 1-100 based on firmographics, behavior, and engagement.
 */
export async function scoreContact(config, contactId, contactData = null) {
  const db = getDb();
  const weights = config.leadScoring?.weights || {};

  // Use provided data or generate mock
  const data = contactData || generateMockContactData(contactId);

  let score = 0;
  const breakdown = {};

  // Company size (0–20)
  const companySizeWeight = weights.company_size || 20;
  const sizeScore = Math.min(companySizeWeight, (data.employees / 1000) * companySizeWeight);
  breakdown.company_size = Math.round(sizeScore);
  score += sizeScore;

  // Title seniority (0–30)
  const titleWeight = weights.title_seniority || 25;
  const seniorityMap = { 'ceo': 1, 'coo': 1, 'cfo': 1, 'vp': 0.85, 'director': 0.7, 'manager': 0.5, 'analyst': 0.3 };
  const title = (data.title || '').toLowerCase();
  let seniority = 0.4;
  for (const [key, val] of Object.entries(seniorityMap)) {
    if (title.includes(key)) { seniority = val; break; }
  }
  breakdown.title_seniority = Math.round(seniority * titleWeight);
  score += seniority * titleWeight;

  // Interaction count (0–20)
  const interactionWeight = weights.interaction_count || 20;
  const interactionScore = Math.min(interactionWeight, (data.interactions || 0) * 2);
  breakdown.interaction_count = Math.round(interactionScore);
  score += interactionScore;

  // Urgency / deal signals (0–20)
  const urgencyWeight = weights.deal_urgency || weights.timeline_urgency || 20;
  const urgencyMap = { high: 1, medium: 0.6, low: 0.3 };
  const urgencyScore = (urgencyMap[data.urgency] || 0.3) * urgencyWeight;
  breakdown.urgency = Math.round(urgencyScore);
  score += urgencyScore;

  // Industry-specific field (0–15)
  const specificWeight = weights.freight_volume || weights.annual_volume || weights.budget_confirmed || 15;
  const specificScore = data.hasSpecificSignal ? specificWeight : specificWeight * 0.3;
  breakdown.industry_specific = Math.round(specificScore);
  score += specificScore;

  const finalScore = Math.min(100, Math.round(score));

  // Save to DB
  db.prepare(`INSERT OR REPLACE INTO ai_insights (id, client_id, contact_id, score, score_breakdown, updated_at) VALUES (?,?,?,?,?,datetime('now'))`).run(
    uuid(), config.clientId, contactId, finalScore, JSON.stringify(breakdown)
  );

  return { contactId, score: finalScore, breakdown, tier: getTier(finalScore) };
}

// ─── Next Best Action ─────────────────────────────────────────────────────────

export async function getNextBestAction(config, contactId, contextData = {}) {
  const systemPrompt = `You are a CRM sales coach. Based on the contact and deal context, suggest the single best next action for the sales rep. Be specific and actionable. Keep it to 1-2 sentences.`;

  const context = `
Industry: ${config.industry}
Deal Stage: ${contextData.dealStage || 'new_lead'}
Last Interaction: ${contextData.lastInteraction || '5 days ago'}
Lead Score: ${contextData.score || 50}
Urgency: ${contextData.urgency || 'medium'}
Last Activity: ${contextData.lastActivity || 'Email sent'}
`;

  const action = await generateWithClaude(systemPrompt, context);
  return { contactId, nextBestAction: action.trim(), generatedAt: new Date().toISOString() };
}

// ─── Deal Risk Detection ──────────────────────────────────────────────────────

export async function detectDealRisk(config) {
  const db = getDb();
  const { results: deals } = await getDeals(config, 50);
  const risks = [];

  for (const deal of deals) {
    const lastModified = new Date(deal.properties.hs_lastmodifieddate || deal.createdAt);
    const daysSinceActivity = Math.floor((Date.now() - lastModified) / (1000 * 60 * 60 * 24));
    const probability = deal.properties.hs_deal_stage_probability || 50;
    const amount = parseFloat(deal.properties.amount) || 0;

    let riskLevel = 'low';
    let riskReason = null;

    if (daysSinceActivity >= 7 && probability < 50) {
      riskLevel = 'high';
      riskReason = `No activity in ${daysSinceActivity} days with ${probability}% win probability`;
    } else if (daysSinceActivity >= 5) {
      riskLevel = 'medium';
      riskReason = `No activity in ${daysSinceActivity} days`;
    } else if (probability < 20) {
      riskLevel = 'medium';
      riskReason = `Low win probability: ${probability}%`;
    }

    if (riskLevel !== 'low') {
      risks.push({
        dealId: deal.id,
        dealName: deal.properties.dealname,
        amount,
        riskLevel,
        riskReason,
        daysSinceActivity,
        probability
      });
    }
  }

  return { totalDeals: deals.length, atRisk: risks.length, risks };
}

// ─── Email Drafter ────────────────────────────────────────────────────────────

export async function draftFollowUpEmail(config, contactData, dealContext) {
  const systemPrompt = `You are a professional sales email writer for a ${config.industry} company called ${config.name}. 
Write a concise, personalized follow-up email. No subject line needed, just the body.
Tone: Professional but warm. Maximum 4 short paragraphs.`;

  const context = `
Contact: ${contactData.name || 'the contact'}
Company: ${contactData.company || 'their company'}
Deal Stage: ${dealContext.stage || 'initial conversation'}
Last Interaction: ${dealContext.lastNote || 'previous email'}
Key Points to Reference: ${dealContext.keyPoints || 'their interest in our services'}
`;

  const draft = await generateWithClaude(systemPrompt, context);
  return { draft: draft.trim(), generatedAt: new Date().toISOString() };
}

// ─── Revenue Forecasting ──────────────────────────────────────────────────────

export async function getForecast(config) {
  const { results: deals } = await getDeals(config, 100);

  const stageWinRates = { new_lead: 0.05, qualified: 0.2, proposal: 0.4, negotiation: 0.65, rfq_sent: 0.35, discovery: 0.15, contract: 0.8, closed_won: 1, closed_lost: 0 };

  let weightedPipeline = 0;
  let bestCase = 0;
  let worstCase = 0;
  let closedWon = 0;
  const byStage = {};

  for (const deal of deals) {
    const stage = deal.properties.dealstage;
    const amount = parseFloat(deal.properties.amount) || 0;
    const winRate = stageWinRates[stage] || 0.1;
    const weighted = amount * winRate;

    weightedPipeline += weighted;
    bestCase += amount * Math.min(1, winRate * 1.5);
    worstCase += amount * Math.max(0, winRate * 0.5);

    if (stage === 'closed_won') closedWon += amount;

    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count++;
    byStage[stage].value += amount;
  }

  return {
    totalPipelineValue: deals.reduce((s, d) => s + (parseFloat(d.properties.amount) || 0), 0),
    weightedForecast: Math.round(weightedPipeline),
    bestCase: Math.round(bestCase),
    worstCase: Math.round(worstCase),
    closedWonThisMonth: Math.round(closedWon),
    totalDeals: deals.length,
    byStage,
    generatedAt: new Date().toISOString()
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score) {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'cool';
  return 'cold';
}

function generateMockContactData(contactId) {
  const titles = ['CEO', 'VP of Operations', 'Director of Logistics', 'Procurement Manager', 'Supply Chain Analyst'];
  return {
    employees: Math.floor(Math.random() * 500 + 10),
    title: titles[Math.floor(Math.random() * titles.length)],
    interactions: Math.floor(Math.random() * 10),
    urgency: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
    hasSpecificSignal: Math.random() > 0.4
  };
}
