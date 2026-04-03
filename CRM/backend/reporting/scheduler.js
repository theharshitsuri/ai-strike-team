import cron from 'node-cron';
import { getAllConfigs } from '../core/configLoader.js';
import { generateWeeklyReport } from './weeklyReport.js';

export const scheduler = {
  start() {
    // Weekly report — every Monday at 8 AM
    cron.schedule('0 8 * * 1', async () => {
      console.log('[Scheduler] Running weekly reports...');
      const configs = getAllConfigs();
      for (const config of configs) {
        try {
          await generateWeeklyReport(config);
          console.log(`[Scheduler] Weekly report sent for ${config.clientId}`);
        } catch (err) {
          console.error(`[Scheduler] Report failed for ${config.clientId}:`, err.message);
        }
      }
    });

    console.log('⏰ Scheduler started (weekly reports: Monday 8AM)');
  }
};
