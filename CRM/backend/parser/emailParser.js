import { v4 as uuid } from 'uuid';
import { extractWithClaude } from '../core/claudeClient.js';
import { createContact, updateContact, searchContacts, logActivity } from '../core/hubspot.js';
import { getDb } from '../db/db.js';
import { PARSER_PROMPTS } from './prompts/verticals.js';

/**
 * Parse a raw email and create/update a HubSpot contact + deal.
 */
export async function parseEmail(config, emailText, metadata = {}) {
  const jobId = uuid();
  const vertical = config.parser.vertical;
  const db = getDb();

  // Log job start
  db.prepare(`INSERT INTO parse_jobs (id, client_id, type, source, status, input_preview) VALUES (?,?,?,?,?,?)`).run(
    jobId, config.clientId, 'email', metadata.source || 'manual', 'processing', emailText.slice(0, 200)
  );

  try {
    const promptFn = PARSER_PROMPTS[vertical]?.email;
    if (!promptFn) throw new Error(`No email prompt for vertical: ${vertical}`);

    const extracted = await extractWithClaude(
      'You are a CRM data extraction specialist. Always return valid JSON only.',
      promptFn(emailText)
    );

    const emailAddr = extracted.email || metadata.senderEmail || '';
    const contactFields = {
      firstname: extracted.contact_name?.split(' ')[0] || 'Unknown',
      lastname: extracted.contact_name?.split(' ').slice(1).join(' ') || '',
      email: emailAddr,
      company: extracted.company || '',
      phone: extracted.phone || '',
      hs_lead_status: extracted.urgency === 'high' ? 'IN_PROGRESS' : 'NEW'
    };

    // Deduplicate: search by email before creating
    let contact;
    if (emailAddr) {
      const existing = await searchContacts(config, emailAddr);
      if (existing?.results?.length > 0) {
        const existingContact = existing.results[0];
        contact = await updateContact(config, existingContact.id, contactFields);
        contact.id = existingContact.id;
      }
    }
    if (!contact) {
      contact = await createContact(config, contactFields);
    }

    // Mirror to local cache
    db.prepare(`INSERT OR REPLACE INTO contacts_cache
      (id, client_id, hubspot_id, firstname, lastname, email, phone, company, lead_status, source, last_activity_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).run(
      contact.id, config.clientId, contact.id,
      contactFields.firstname, contactFields.lastname, emailAddr,
      contactFields.phone, contactFields.company, contactFields.hs_lead_status,
      metadata.source || 'email');


    // Log activity note
    const noteBody = `📧 Email parsed by AI\n\nIntent: ${extracted.intent}\nUrgency: ${extracted.urgency}\nEstimated Value: $${extracted.estimated_value || 'unknown'}\n\nNext Step: ${extracted.next_step}\n\nRaw extraction confidence: ${Math.round((extracted.confidence || 0.8) * 100)}%`;
    await logActivity(config, contact.id, noteBody);

    // Update job record
    db.prepare(`UPDATE parse_jobs SET status=?, output_json=?, hubspot_contact_id=?, confidence=?, processed_at=datetime('now') WHERE id=?`).run(
      'completed', JSON.stringify(extracted), contact.id, extracted.confidence || 0.8, jobId
    );

    // Add to activity feed
    db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_id, contact_name, metadata) VALUES (?,?,?,?,?,?,?,?)`).run(
      uuid(), config.clientId, 'parse_email',
      `Email parsed: ${extracted.contact_name || 'Unknown'}`,
      `${extracted.intent} from ${extracted.company || 'unknown company'} — Urgency: ${extracted.urgency}`,
      contact.id, extracted.contact_name,
      JSON.stringify({ jobId, confidence: extracted.confidence, deal_size: extracted.estimated_value })
    );

    return { jobId, contactId: contact.id, extracted, status: 'completed' };
  } catch (err) {
    db.prepare(`UPDATE parse_jobs SET status=?, error=?, processed_at=datetime('now') WHERE id=?`).run('failed', err.message, jobId);
    throw err;
  }
}

/**
 * Parse a call transcript and update CRM.
 */
export async function parseTranscript(config, transcriptText, contactId = null) {
  const jobId = uuid();
  const vertical = config.parser.vertical;
  const db = getDb();

  db.prepare(`INSERT INTO parse_jobs (id, client_id, type, source, status, input_preview) VALUES (?,?,?,?,?,?)`).run(
    jobId, config.clientId, 'transcript', 'call', 'processing', transcriptText.slice(0, 200)
  );

  try {
    const promptFn = PARSER_PROMPTS[vertical]?.transcript;
    if (!promptFn) throw new Error(`No transcript prompt for vertical: ${vertical}`);

    const extracted = await extractWithClaude(
      'You are a sales call analyst. Always return valid JSON only.',
      promptFn(transcriptText)
    );

    if (contactId) {
      const noteBody = `📞 Call Transcript Parsed\n\nOutcome: ${extracted.call_outcome}\nNext Step: ${extracted.next_step}\n\n${extracted.action_items?.map(i => `✅ ${i}`).join('\n') || ''}\n\nRep Notes: ${extracted.rep_notes}`;
      await logActivity(config, contactId, noteBody);
    }

    db.prepare(`UPDATE parse_jobs SET status=?, output_json=?, hubspot_contact_id=?, confidence=?, processed_at=datetime('now') WHERE id=?`).run(
      'completed', JSON.stringify(extracted), contactId, extracted.confidence || 0.8, jobId
    );

    return { jobId, extracted, status: 'completed' };
  } catch (err) {
    db.prepare(`UPDATE parse_jobs SET status=?, error=?, processed_at=datetime('now') WHERE id=?`).run('failed', err.message, jobId);
    throw err;
  }
}

/**
 * Intelligently parse a CSV file, map columns to CRM schema, and bulk-import contacts.
 */
export async function parseCsv(config, csvText, options = {}) {
  const jobId = uuid();
  const db = getDb();
  const { importToHubspot = false } = options;

  db.prepare(`INSERT INTO parse_jobs (id, client_id, type, source, status, input_preview) VALUES (?,?,?,?,?,?)`).run(
    jobId, config.clientId, 'csv', 'upload', 'processing', csvText.slice(0, 200)
  );

  try {
    const systemPrompt = `You are a CRM data import specialist. Analyze the CSV and return ONLY valid JSON.
Return:
{
  "column_mapping": { "csv_column_name": "crm_field_name_or_null" },
  "detected_rows": number,
  "all_contacts": [array of ALL parsed contact objects with fields: firstname, lastname, email, phone, company, jobtitle, city, state, country, website],
  "sample_contacts": [first 3 from all_contacts],
  "data_quality_issues": ["array of issues found"],
  "confidence": number
}

CRM fields available: firstname, lastname, email, phone, company, jobtitle, city, state, country, website
Parse ALL rows if there are 200 or fewer; otherwise parse up to 200.`;

    const extracted = await extractWithClaude(systemPrompt, `CSV Data:\n${csvText.slice(0, 6000)}`);

    const importResults = { created: 0, updated: 0, failed: 0, errors: [] };

    if (importToHubspot && extracted.all_contacts?.length > 0) {
      for (const contact of extracted.all_contacts) {
        try {
          let existing = null;
          if (contact.email) {
            const search = await searchContacts(config, contact.email);
            if (search?.results?.length > 0) existing = search.results[0];
          }

          if (existing) {
            await updateContact(config, existing.id, contact);
            db.prepare(`INSERT OR REPLACE INTO contacts_cache
              (id, client_id, hubspot_id, firstname, lastname, email, phone, company, jobtitle, source, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`).run(
              existing.id, config.clientId, existing.id,
              contact.firstname, contact.lastname, contact.email,
              contact.phone, contact.company, contact.jobtitle, 'csv_import');
            importResults.updated++;
          } else {
            const created = await createContact(config, contact);
            db.prepare(`INSERT OR REPLACE INTO contacts_cache
              (id, client_id, hubspot_id, firstname, lastname, email, phone, company, jobtitle, source, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).run(
              created.id, config.clientId, created.id,
              contact.firstname, contact.lastname, contact.email,
              contact.phone, contact.company, contact.jobtitle, 'csv_import');
            importResults.created++;
          }
        } catch (e) {
          importResults.failed++;
          importResults.errors.push(e.message);
        }
      }
    }

    const result = { ...extracted, importResults: importToHubspot ? importResults : null };
    db.prepare(`UPDATE parse_jobs SET status=?, output_json=?, confidence=?, processed_at=datetime('now') WHERE id=?`).run(
      'completed', JSON.stringify(result), extracted.confidence || 0.85, jobId
    );

    return { jobId, extracted: result, status: 'completed' };
  } catch (err) {
    db.prepare(`UPDATE parse_jobs SET status=?, error=?, processed_at=datetime('now') WHERE id=?`).run('failed', err.message, jobId);
    throw err;
  }
}

/**
 * Parse a document (invoice, RFQ, contract) and extract key fields.
 */
export async function parseDocument(config, docText, docType = 'unknown') {
  const jobId = uuid();
  const vertical = config.parser.vertical;
  const db = getDb();

  db.prepare(`INSERT INTO parse_jobs (id, client_id, type, source, status, input_preview) VALUES (?,?,?,?,?,?)`).run(
    jobId, config.clientId, 'document', docType, 'processing', docText.slice(0, 200)
  );

  try {
    const promptFn = PARSER_PROMPTS[vertical]?.document;
    if (!promptFn) throw new Error(`No document prompt for vertical: ${vertical}`);

    const extracted = await extractWithClaude(
      'You are a document data extraction specialist. Always return valid JSON only.',
      promptFn(docText)
    );

    db.prepare(`UPDATE parse_jobs SET status=?, output_json=?, confidence=?, processed_at=datetime('now') WHERE id=?`).run(
      'completed', JSON.stringify(extracted), extracted.confidence || 0.8, jobId
    );

    db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, metadata) VALUES (?,?,?,?,?,?)`).run(
      uuid(), config.clientId, 'parse_document',
      `Document parsed: ${extracted.document_type || docType}`,
      `${extracted.shipper_name || extracted.company_name || 'Unknown'} — Value: $${extracted.invoice_amount || extracted.total_value || extracted.contract_value || 'N/A'}`,
      JSON.stringify({ jobId, docType, confidence: extracted.confidence })
    );

    return { jobId, extracted, status: 'completed' };
  } catch (err) {
    db.prepare(`UPDATE parse_jobs SET status=?, error=?, processed_at=datetime('now') WHERE id=?`).run('failed', err.message, jobId);
    throw err;
  }
}
