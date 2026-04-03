import { Router } from 'express';
import { loadConfig, getAllConfigs } from '../core/configLoader.js';

const router = Router();

// GET /config — list all client configs
router.get('/', (req, res) => {
  try {
    const configs = getAllConfigs();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /config/:clientId
router.get('/:clientId', (req, res) => {
  try {
    const config = loadConfig(req.params.clientId);
    res.json(config);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
