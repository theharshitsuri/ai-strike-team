import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/crm.db');

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export async function initDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      branding_primary_color TEXT DEFAULT '#6366f1',
      branding_logo_url TEXT,
      branding_company_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parse_jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT,
      status TEXT DEFAULT 'pending',
      input_preview TEXT,
      output_json TEXT,
      hubspot_contact_id TEXT,
      hubspot_deal_id TEXT,
      confidence REAL DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT DEFAULT 'initiated',
      vapi_call_id TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      hubspot_contact_id TEXT,
      duration_seconds INTEGER DEFAULT 0,
      outcome TEXT,
      transcript TEXT,
      summary TEXT,
      qualification_notes TEXT,
      coaching_feedback TEXT,
      talk_ratio REAL,
      objections_handled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      direction TEXT,
      contact_phone TEXT,
      contact_name TEXT,
      message_body TEXT,
      twilio_sid TEXT,
      status TEXT DEFAULT 'sent',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      description TEXT,
      contact_id TEXT,
      contact_name TEXT,
      deal_id TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      score_breakdown TEXT,
      next_best_action TEXT,
      risk_level TEXT DEFAULT 'low',
      risk_reason TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      report_data TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Local contact cache (mirrors HubSpot, enables offline search + enrichment)
    CREATE TABLE IF NOT EXISTS contacts_cache (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      hubspot_id TEXT,
      firstname TEXT,
      lastname TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      jobtitle TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      website TEXT,
      lead_status TEXT DEFAULT 'NEW',
      lead_score INTEGER DEFAULT 0,
      source TEXT,
      tags TEXT,
      notes TEXT,
      last_activity_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts_cache(client_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts_cache(email);

    -- Local deals cache
    CREATE TABLE IF NOT EXISTS deals_cache (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      hubspot_id TEXT,
      dealname TEXT NOT NULL,
      amount REAL DEFAULT 0,
      dealstage TEXT,
      closedate TEXT,
      contact_id TEXT,
      probability REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_deals_client ON deals_cache(client_id);

    -- DocuSign document tracking
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      docusign_envelope_id TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      contact_id TEXT,
      deal_id TEXT,
      signer_name TEXT,
      signer_email TEXT,
      document_name TEXT,
      signed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Seed demo tenant records
    INSERT OR IGNORE INTO tenants (id, name, industry) VALUES
      ('client_logistics', 'Freight Masters LLC', 'logistics'),
      ('client_manufacturing', 'Precision Parts Inc.', 'manufacturing'),
      ('client_services', 'Apex Consulting Group', 'services');
  `);

  console.log('✅ Database initialized at', dbPath);
  return db;
}
