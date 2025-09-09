import { db } from './db';
import { systemBackups, opportunities } from '@shared/schema';
import { eq, desc, lt } from 'drizzle-orm';
import type { SystemBackup } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as XLSX from 'xlsx';

const execAsync = promisify(exec);

class BackupService {
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('📦 Failed to create backup directory:', error);
    }
  }

  async createDatabaseBackup(type: 'manual' | 'automatic' = 'automatic'): Promise<boolean> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `crm-backup-${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      // Log backup start
      const backupRecord = await db.insert(systemBackups).values({
        filename,
        size: 0,
        type,
        status: 'in_progress',
      }).returning();

      const backupId = backupRecord[0].id;

      // Create database backup using pg_dump
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Extract connection details from URL
      const url = new URL(databaseUrl);
      const command = `pg_dump "${databaseUrl}" > "${filepath}"`;

      await execAsync(command);

      // Get file size
      const stats = await fs.stat(filepath);
      const fileSize = stats.size;

      // Update backup record
      await db.update(systemBackups)
        .set({
          size: fileSize,
          status: 'completed',
        })
        .where(eq(systemBackups.id, backupId));

      console.log(`📦 Database backup created: ${filename} (${this.formatFileSize(fileSize)})`);
      return true;

    } catch (error) {
      console.error('📦 Database backup failed:', error);
      
      // Try to update backup record as failed
      try {
        await db.update(systemBackups)
          .set({
            status: 'failed',
          })
          .where(eq(systemBackups.filename, filename));
      } catch (updateError) {
        console.error('📦 Failed to update backup status:', updateError);
      }

      return false;
    }
  }

  async createDataExport(format: 'json' | 'excel' = 'json'): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `crm-export-${timestamp}.${format}`;
      const filepath = path.join(this.backupDir, filename);

      // Export opportunities data
      const opportunitiesData = await db
        .select()
        .from(opportunities)
        .orderBy(desc(opportunities.createdAt));

      if (format === 'json') {
        await fs.writeFile(filepath, JSON.stringify(opportunitiesData, null, 2));
      } else if (format === 'excel') {
        // Use xlsx library for Excel export
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(opportunitiesData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Oportunidades');
        XLSX.writeFile(workbook, filepath);
      }

      console.log(`📦 Data export created: ${filename}`);
      return filepath;

    } catch (error) {
      console.error('📦 Data export failed:', error);
      return null;
    }
  }

  async cleanupOldBackups(maxAge: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      // Delete old backup records
      await db.delete(systemBackups)
        .where(lt(systemBackups.createdAt, cutoffDate));

      // Clean up physical files
      const files = await fs.readdir(this.backupDir);
      
      for (const file of files) {
        const filepath = path.join(this.backupDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          console.log(`📦 Deleted old backup: ${file}`);
        }
      }

    } catch (error) {
      console.error('📦 Backup cleanup failed:', error);
    }
  }

  async getBackupHistory(limit: number = 50) {
    try {
      return await db
        .select()
        .from(systemBackups)
        .orderBy(desc(systemBackups.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('📦 Failed to get backup history:', error);
      return [];
    }
  }

  async restoreFromBackup(backupFilename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.backupDir, backupFilename);
      
      // Check if backup file exists
      await fs.access(filepath);

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Restore database using psql
      const command = `psql "${databaseUrl}" < "${filepath}"`;
      await execAsync(command);

      console.log(`📦 Database restored from: ${backupFilename}`);
      return true;

    } catch (error) {
      console.error('📦 Database restore failed:', error);
      return false;
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const backupService = new BackupService();