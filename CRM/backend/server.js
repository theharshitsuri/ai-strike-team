import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/db.js';
import { scheduler } from './reporting/scheduler.js';

// Routes
import webhookRoutes from './routes/webhooks.js';
import parserRoutes from './routes/parser.js';
import voiceRoutes from './routes/voice.js';
import intelligenceRoutes from './routes/intelligence.js';
import configRoutes from './routes/config.js';
import dashboardRoutes from './routes/dashboard.js';
import contactsRoutes from './routes/contacts.js';
import onboardingRoutes from './routes/onboarding.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  const clientId = req.headers['x-client-id'] || process.env.DEFAULT_CLIENT_ID || 'client_logistics';
  req.clientId = clientId;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} [client: ${clientId}]`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRoutes);
app.use('/parse', parserRoutes);
app.use('/voice', voiceRoutes);
app.use('/ai', intelligenceRoutes);
app.use('/config', configRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/contacts', contactsRoutes);
app.use('/onboarding', onboardingRoutes);

// Enhanced health check — shows integration status
app.get('/health', (req, res) => {
  const integrations = {
    hubspot:     !!process.env.HUBSPOT_ACCESS_TOKEN,
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
    vapi:        !!process.env.VAPI_API_KEY,
    twilio:      !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    slack:       !!process.env.SLACK_BOT_TOKEN,
    gmail:       !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN),
    stripe:      !!process.env.STRIPE_WEBHOOK_SECRET,
    docusign:    !!process.env.DOCUSIGN_HMAC_KEY,
  };
  const configuredCount = Object.values(integrations).filter(Boolean).length;

  res.json({
    status: 'ok',
    version: '2.0.0',
    mockMode: process.env.MOCK_MODE === 'true',
    integrations,
    configuredIntegrations: `${configuredCount}/${Object.keys(integrations).length}`,
    timestamp: new Date().toISOString()
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDb();
  scheduler.start();
  app.listen(PORT, () => {
    console.log(`\n🚀 CRM Automation Engine running on http://localhost:${PORT}`);
    console.log(`📊 Mock mode: ${process.env.MOCK_MODE === 'true' ? 'ON (no real API calls)' : 'OFF (live APIs)'}`);
    console.log(`🏢 Default client: ${process.env.DEFAULT_CLIENT_ID || 'client_logistics'}\n`);
  });
}

start().catch(console.error);
