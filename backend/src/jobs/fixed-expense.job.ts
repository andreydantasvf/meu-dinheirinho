import cron from 'node-cron';
import { fixedExpenseService } from '../services/fixed-expense.service';

export function startFixedExpenseJob() {
  // Run daily at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Ensuring fixed expense horizons...');
    try {
      await fixedExpenseService.ensureHorizon();
      console.log('[Cron] Fixed expenses generated successfully.');
    } catch (error) {
      console.error('[Cron] Error generating fixed expenses:', error);
    }
  });

  // Also run once at startup
  setTimeout(async () => {
    try {
      console.log('[Startup] Ensuring fixed expense horizons...');
      await fixedExpenseService.ensureHorizon();
    } catch (error) {
      console.error('[Startup] Error generating fixed expenses:', error);
    }
  }, 1000);
}
