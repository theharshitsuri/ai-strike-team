import { Router } from 'express';
import { loadConfig } from '../core/configLoader.js';
import { parseEmail, parseTranscript, parseCsv, parseDocument } from '../parser/emailParser.js';
import { getDb } from '../db/db.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /parse/email
router.post('/email', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { emailText, metadata } = req.body;
    if (!emailText) return res.status(400).json({ error: 'emailText is required' });
    const result = await parseEmail(config, emailText, metadata || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /parse/transcript
router.post('/transcript', async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    const { transcriptText, contactId } = req.body;
    if (!transcriptText) return res.status(400).json({ error: 'transcriptText is required' });
    const result = await parseTranscript(config, transcriptText, contactId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /parse/csv
router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    let csvText = req.body.csvText;
    if (!csvText && req.file) csvText = req.file.buffer.toString('utf-8');
    if (!csvText) return res.status(400).json({ error: 'csvText or file is required' });
    const result = await parseCsv(config, csvText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /parse/document
router.post('/document', upload.single('file'), async (req, res) => {
  try {
    const config = loadConfig(req.clientId);
    let docText = req.body.docText;
    const docType = req.body.docType || 'unknown';
    if (!docText && req.file) docText = req.file.buffer.toString('utf-8');
    if (!docText) return res.status(400).json({ error: 'docText or file is required' });
    const result = await parseDocument(config, docText, docType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /parse/jobs — list recent parse jobs
router.get('/jobs', (req, res) => {
  try {
    const db = getDb();
    const jobs = db.prepare(`SELECT * FROM parse_jobs WHERE client_id=? ORDER BY created_at DESC LIMIT 50`).all(req.clientId);
    res.json({ jobs, total: jobs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
