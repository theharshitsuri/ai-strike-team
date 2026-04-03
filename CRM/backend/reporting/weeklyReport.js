import nodemailer from 'nodemailer';
import { getDeals } from '../core/hubspot.js';
import { getForecast } from '../intelligence/leadScoring.js';
import { getDb } from '../db/db.js';
import { v4 as uuid } from 'uuid';

export async function generateWeeklyReport(config) {
  const db = getDb();
  const [dealsResult, forecast] = await Promise.all([getDeals(config, 100), getForecast(config)]);
  const callStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN outcome='qualified' THEN 1 ELSE 0 END) as qualified FROM call_logs WHERE client_id=? AND created_at >= datetime('now', '-7 days')`).get(config.clientId);
  const parseStats = db.prepare(`SELECT COUNT(*) as total FROM parse_jobs WHERE client_id=? AND created_at >= datetime('now', '-7 days')`).get(config.clientId);

  const reportData = { dealsResult: dealsResult.results.length, forecast, callStats, parseStats, generatedAt: new Date().toISOString() };

  // Save report
  db.prepare(`INSERT INTO weekly_reports (id, client_id, period_start, period_end, report_data) VALUES (?,?,datetime('now','-7 days'),datetime('now'),?)`).run(uuid(), config.clientId, JSON.stringify(reportData));

  if (process.env.MOCK_MODE === 'true') {
    console.log(`[WeeklyReport] Mock mode — report generated for ${config.clientId}`);
    return reportData;
  }

  // Send email
  const transporter = nodemailer.createTransporter({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const html = buildReportHtml(config, reportData);

  for (const recipient of (config.reporting?.weeklyRecipients || [])) {
    await transporter.sendMail({ from: process.env.SMTP_USER, to: recipient, subject: `📊 Weekly Sales Report — ${config.name}`, html });
  }

  return reportData;
}

function buildReportHtml(config, data) {
  return `<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto">
<h2>📊 Weekly Sales Report — ${config.name}</h2>
<p>Week ending ${new Date().toLocaleDateString()}</p>
<table style="width:100%;border-collapse:collapse">
<tr><th style="text-align:left;padding:8px;background:#1e293b;color:white">Metric</th><th style="padding:8px;background:#1e293b;color:white">This Week</th></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Total Deals in Pipeline</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${data.dealsResult}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Weighted Forecast</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">$${data.forecast.weightedForecast?.toLocaleString()}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Calls Made</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${data.callStats?.total || 0}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Leads Qualified via Call</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${data.callStats?.qualified || 0}</td></tr>
<tr><td style="padding:8px">Emails/Docs Parsed</td><td style="padding:8px">${data.parseStats?.total || 0}</td></tr>
</table>
<p style="color:#64748b;font-size:12px">Generated automatically by your CRM Automation Engine</p>
</body></html>`;
}
