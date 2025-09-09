import * as cron from 'node-cron';
import { backupService } from './backup-service';
import { generateSalesReports } from './reports-service';

class SchedulerService {
  constructor() {
    this.initializeScheduledTasks();
  }

  private initializeScheduledTasks() {
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Running scheduled database backup...');
      await backupService.createDatabaseBackup('automatic');
    });

    // Weekly backup cleanup (every Sunday at 3 AM)
    cron.schedule('0 3 * * 0', async () => {
      console.log('🕐 Running weekly backup cleanup...');
      await backupService.cleanupOldBackups(30); // Keep 30 days
    });

    // Daily sales reports generation at 6 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('🕐 Generating daily sales reports...');
      await generateSalesReports();
    });

    // Monthly comprehensive reports (1st day of month at 7 AM)
    cron.schedule('0 7 1 * *', async () => {
      console.log('🕐 Generating monthly comprehensive reports...');
      await generateSalesReports('monthly');
    });

    console.log('📅 Scheduled tasks initialized');
  }

  // Allow manual task execution
  async runBackup() {
    return await backupService.createDatabaseBackup('manual');
  }

  async runReportsGeneration() {
    return await generateSalesReports();
  }

  async runBackupCleanup() {
    return await backupService.cleanupOldBackups(30);
  }
}

export const schedulerService = new SchedulerService();