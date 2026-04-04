import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { loadConfig } from '../core/configLoader.js';
import { createContact, updateContact, searchContacts, getContact, logActivity } from '../core/hubspot.js';
import { scoreContact } from '../intelligence/leadScoring.js';
import { getDb } from '../db/db.js';

const router = Router();

// GET /contacts — list all cached contacts with optional search
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { q, limit = 50, offset = 0, sort = 'updated_at', order = 'DESC' } = req.query;

    const allowedSorts = ['updated_at', 'created_at', 'lead_score', 'firstname', 'company'];
    const safeSort = allowedSorts.includes(sort) ? sort : 'updated_at';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    let contacts, total;
    if (q) {
      const like = `%${q}%`;
      contacts = db.prepare(`
        SELECT c.*, i.score as lead_score, i.next_best_action
        FROM contacts_cache c
        LEFT JOIN ai_insights i ON i.contact_id = c.id AND i.client_id = c.client_id
        WHERE c.client_id=? AND (c.firstname LIKE ? OR c.lastname LIKE ? OR c.email LIKE ? OR c.company LIKE ?)
        ORDER BY c.${safeSort} ${safeOrder}
        LIMIT ? OFFSET ?
      `).all(req.clientId, like, like, like, like, parseInt(limit), parseInt(offset));
      total = db.prepare(`
        SELECT COUNT(*) as n FROM contacts_cache
        WHERE client_id=? AND (firstname LIKE ? OR lastname LIKE ? OR email LIKE ? OR company LIKE ?)
      `).get(req.clientId, like, like, like, like).n;
    } else {
      contacts = db.prepare(`
        SELECT c.*, i.score as lead_score, i.next_best_action
        FROM contacts_cache c
        LEFT JOIN ai_insights i ON i.contact_id = c.id AND i.client_id = c.client_id
        WHERE c.client_id=?
        ORDER BY c.${safeSort} ${safeOrder}
        LIMIT ? OFFSET ?
      `).all(req.clientId, parseInt(limit), parseInt(offset));
      total = db.prepare(`SELECT COUNT(*) as n FROM contacts_cache WHERE client_id=?`).get(req.clientId).n;
    }

    res.json({ contacts, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contacts/:id — single contact with AI insight
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const contact = db.prepare(`SELECT * FROM contacts_cache WHERE id=? AND client_id=?`).get(req.params.id, req.clientId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const insight = db.prepare(`SELECT * FROM ai_insights WHERE contact_id=? AND client_id=?`).get(req.params.id, req.clientId);
    const recentActivity = db.prepare(`SELECT * FROM activity_feed WHERE contact_id=? AND client_id=? ORDER BY created_at DESC LIMIT 10`).all(req.params.id, req.clientId);

    res.json({ ...contact, insight, recentActivity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contacts — create a new contact
router.post('/', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const db = getDb();
    const { firstname, lastname, email, phone, company, jobtitle, city, state, country, website } = req.body;

    if (!firstname && !email) return res.status(400).json({ error: 'firstname or email is required' });

    const fields = { firstname, lastname, email, phone, company, jobtitle, city, state, country, website };
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);

    const contact = await createContact(config, fields);
    const id = contact.id;

    db.prepare(`INSERT OR REPLACE INTO contacts_cache
      (id, client_id, hubspot_id, firstname, lastname, email, phone, company, jobtitle, city, state, country, website, source, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).run(
      id, req.clientId, id, firstname, lastname, email, phone, company, jobtitle, city, state, country, website, 'manual'
    );

    db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_id, contact_name, metadata) VALUES (?,?,?,?,?,?,?,?)`).run(
      uuid(), req.clientId, 'contact_created',
      `New contact: ${firstname} ${lastname || ''}`.trim(),
      `${email || ''} · ${company || ''}`.replace(/^·\s*|·\s*$/, '').trim(),
      id, `${firstname} ${lastname || ''}`.trim(),
      JSON.stringify({ source: 'manual' })
    );

    res.status(201).json({ id, ...fields, hubspot_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /contacts/:id — update a contact
router.patch('/:id', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const db = getDb();
    const contact = db.prepare(`SELECT * FROM contacts_cache WHERE id=? AND client_id=?`).get(req.params.id, req.clientId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const allowed = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'city', 'state', 'country', 'website', 'lead_status', 'notes', 'tags'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Update HubSpot
    const hubspotFields = { ...updates };
    delete hubspotFields.notes;
    delete hubspotFields.tags;
    if (Object.keys(hubspotFields).length > 0) {
      await updateContact(config, req.params.id, hubspotFields);
    }

    // Update local cache
    const setClauses = Object.keys(updates).map(k => `${k}=?`).join(', ');
    db.prepare(`UPDATE contacts_cache SET ${setClauses}, updated_at=datetime('now') WHERE id=? AND client_id=?`)
      .run(...Object.values(updates), req.params.id, req.clientId);

    res.json({ id: req.params.id, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contacts/:id/score — re-score a contact
router.post('/:id/score', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const db = getDb();
    const contact = db.prepare(`SELECT * FROM contacts_cache WHERE id=? AND client_id=?`).get(req.params.id, req.clientId);
    const contactData = contact ? {
      employees: req.body.employees || 50,
      title: contact.jobtitle || '',
      interactions: req.body.interactions || 0,
      urgency: req.body.urgency || 'medium',
      hasSpecificSignal: req.body.hasSpecificSignal || false
    } : null;

    const result = await scoreContact(config, req.params.id, contactData);

    // Update local cache score
    db.prepare(`UPDATE contacts_cache SET lead_score=?, updated_at=datetime('now') WHERE id=? AND client_id=?`)
      .run(result.score, req.params.id, req.clientId);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /contacts/:id/note — add an activity note
router.post('/:id/note', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const db = getDb();
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'note is required' });

    await logActivity(config, req.params.id, note);
    db.prepare(`UPDATE contacts_cache SET last_activity_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND client_id=?`)
      .run(req.params.id, req.clientId);

    db.prepare(`INSERT INTO activity_feed (id, client_id, type, title, description, contact_id, metadata) VALUES (?,?,?,?,?,?,?)`).run(
      uuid(), req.clientId, 'note_added', 'Note added', note.slice(0, 100), req.params.id, JSON.stringify({ contactId: req.params.id })
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /contacts/stats/summary — contact stats for dashboard
router.get('/stats/summary', (req, res) => {
  try {
    const db = getDb();
    const total = db.prepare(`SELECT COUNT(*) as n FROM contacts_cache WHERE client_id=?`).get(req.clientId).n;
    const byStatus = db.prepare(`SELECT lead_status, COUNT(*) as n FROM contacts_cache WHERE client_id=? GROUP BY lead_status`).all(req.clientId);
    const recentlyAdded = db.prepare(`SELECT COUNT(*) as n FROM contacts_cache WHERE client_id=? AND created_at >= datetime('now', '-7 days')`).get(req.clientId).n;
    const avgScore = db.prepare(`SELECT AVG(lead_score) as avg FROM contacts_cache WHERE client_id=? AND lead_score > 0`).get(req.clientId).avg;
    res.json({ total, recentlyAdded, avgScore: Math.round(avgScore || 0), byStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
