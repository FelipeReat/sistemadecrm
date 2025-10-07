import { db } from './db';
import { opportunities, salesReports, users } from '@shared/schema';
import { eq, count, sum, gte, lte, and, desc } from 'drizzle-orm';
import type { InsertSalesReport } from '@shared/schema';

export async function generateSalesReports(period: 'daily' | 'monthly' | 'quarterly' = 'daily') {
  try {
    
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    // Define date ranges based on period
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3 - 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3, 0);
        break;
    }

    // Get all salespeople (exclude admin)
    const salespeople = await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'usuario'), eq(users.isActive, true)));

    // Generate reports for each salesperson
    for (const salesperson of salespeople) {
      await generateSalespersonReport(salesperson.id, period, startDate, endDate, now);
    }

    return true;

  } catch (error) {
    console.error('📊 Failed to generate sales reports:', error);
    return false;
  }
}

async function generateSalespersonReport(
  salespersonId: string,
  period: string,
  startDate: Date,
  endDate: Date,
  now: Date
) {
  try {
    // Get opportunities for this salesperson in the date range
    const salespersonOpportunities = await db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.salesperson, salespersonId),
          gte(opportunities.createdAt, startDate),
          lte(opportunities.createdAt, endDate)
        )
      );

    // Calculate metrics
    const totalOpportunities = salespersonOpportunities.length;
    const wonOpportunities = salespersonOpportunities.filter(op => op.phase === 'ganho').length;
    const lostOpportunities = salespersonOpportunities.filter(op => op.phase === 'perdido').length;

    const totalValue = salespersonOpportunities.reduce((sum, op) => {
      const value = parseFloat(op.budget?.toString() || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    const wonValue = salespersonOpportunities
      .filter(op => op.phase === 'ganho')
      .reduce((sum, op) => {
        const value = parseFloat(op.finalValue?.toString() || op.budget?.toString() || '0');
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

    const conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;
    const avgDealSize = wonOpportunities > 0 ? wonValue / wonOpportunities : 0;

    // Create report record
    const reportData: InsertSalesReport = {
      salespersonId,
      period,
      year: now.getFullYear(),
      month: period === 'monthly' ? now.getMonth() + 1 : null,
      totalOpportunities,
      wonOpportunities,
      lostOpportunities,
      totalValue: totalValue.toString(),
      wonValue: wonValue.toString(),
      conversionRate: conversionRate.toString(),
      avgDealSize: avgDealSize.toString(),
    };

    await db.insert(salesReports).values(reportData);

  } catch (error) {
    console.error(`📊 Failed to generate report for salesperson ${salespersonId}:`, error);
  }
}

export async function getSalesReportsByPeriod(
  period: string,
  year: number,
  month?: number
) {
  try {
    let query = db
      .select()
      .from(salesReports)
      .where(
        and(
          eq(salesReports.period, period),
          eq(salesReports.year, year)
        )
      );

    if (month !== undefined) {
      query = query.where(eq(salesReports.month, month));
    }

    return await query.orderBy(desc(salesReports.generatedAt));

  } catch (error) {
    console.error('📊 Failed to get sales reports:', error);
    return [];
  }
}

export async function getSalespersonPerformance(salespersonId: string, months: number = 6) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return await db
      .select()
      .from(salesReports)
      .where(
        and(
          eq(salesReports.salespersonId, salespersonId),
          gte(salesReports.generatedAt, startDate),
          lte(salesReports.generatedAt, endDate)
        )
      )
      .orderBy(desc(salesReports.generatedAt));

  } catch (error) {
    console.error('📊 Failed to get salesperson performance:', error);
    return [];
  }
}

export async function getTopPerformers(period: string = 'monthly', limit: number = 10) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let query = db
      .select()
      .from(salesReports)
      .where(
        and(
          eq(salesReports.period, period),
          eq(salesReports.year, currentYear)
        )
      );

    if (period === 'monthly') {
      query = query.where(eq(salesReports.month, currentMonth));
    }

    return await query
      .orderBy(desc(salesReports.wonValue))
      .limit(limit);

  } catch (error) {
    console.error('📊 Failed to get top performers:', error);
    return [];
  }
}