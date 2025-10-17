import {
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from './config';

export interface AnalyticsData {
  date: string; // ISO date string for the period (YYYY-MM-DD for daily, YYYY-WW for weekly, YYYY-MM for monthly, YYYY for yearly)
  lost: number;
  found: number;
  total: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface TimeRangeAnalytics {
  weekly: AnalyticsData[];
  monthly: AnalyticsData[];
  yearly: AnalyticsData[];
}

export const analyticsService = {
  /**
   * Log a new post creation for analytics tracking
   */
  async logPostCreation(postType: 'lost' | 'found'): Promise<void> {
    try {
      const now = new Date();
      const periods = this.getTimePeriods(now);

      // Update all time periods atomically using a batch write
      const batch = [];

      for (const [periodType, dateKey] of periods) {
        const analyticsRef = doc(db, 'analytics', `${periodType}_${dateKey}`);
        batch.push({
          ref: analyticsRef,
          data: {
            date: dateKey,
            [postType]: increment(1),
            total: increment(1),
            period: periodType,
            updatedAt: serverTimestamp()
          }
        });
      }

      // Execute all updates
      for (const { ref, data } of batch) {
        await updateDoc(ref, data).catch(async (error) => {
          // If document doesn't exist, create it
          if (error.code === 'not-found') {
            await setDoc(ref, {
              date: data.date,
              lost: data.lost || 0,
              found: data.found || 0,
              total: data.total || 1,
              period: data.period,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            throw error;
          }
        });
      }

      console.log(`📊 Analytics logged for ${postType} post`);
    } catch (error) {
      console.error('Error logging post creation analytics:', error);
      // Don't throw error to avoid breaking post creation
    }
  },

  /**
   * Get time periods for the current date
   */
  getTimePeriods(date: Date): Array<[string, string]> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() is 0-based
    const day = date.getDate();

    // Get ISO week number
    const weekNumber = this.getISOWeekNumber(date);

    return [
      ['daily', `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`],
      ['weekly', `${year}-W${weekNumber.toString().padStart(2, '0')}`],
      ['monthly', `${year}-${month.toString().padStart(2, '0')}`],
      ['yearly', `${year}`]
    ];
  },

  /**
   * Get ISO week number for a date
   */
  getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  },

  /**
   * Get analytics data for a specific time range and period
   */
  async getAnalyticsData(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    limit: number = 30
  ): Promise<AnalyticsData[]> {
    try {
      const analyticsRef = collection(db, 'analytics');
      const q = query(
        analyticsRef,
        where('period', '==', period),
        orderBy('date', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date,
        lost: doc.data().lost || 0,
        found: doc.data().found || 0,
        total: doc.data().total || 0,
        period: doc.data().period
      })) as AnalyticsData[];
    } catch (error) {
      console.error(`Error fetching ${period} analytics data:`, error);
      return [];
    }
  },

  /**
   * Get all time range analytics data
   */
  async getAllTimeRangeAnalytics(): Promise<TimeRangeAnalytics> {
    try {
      const [weekly, monthly, yearly] = await Promise.all([
        this.getAnalyticsData('weekly', 12), // Last 12 weeks
        this.getAnalyticsData('monthly', 12), // Last 12 months
        this.getAnalyticsData('yearly', 5) // Last 5 years
      ]);

      return {
        weekly: weekly.reverse(), // Reverse to show oldest first for charts
        monthly: monthly.reverse(),
        yearly: yearly.reverse()
      };
    } catch (error) {
      console.error('Error fetching all time range analytics:', error);
      return {
        weekly: [],
        monthly: [],
        yearly: []
      };
    }
  },

  /**
   * Get current period's analytics data (for real-time display)
   */
  async getCurrentPeriodAnalytics(): Promise<{
    thisWeek: AnalyticsData | null;
    thisMonth: AnalyticsData | null;
    thisYear: AnalyticsData | null;
  }> {
    try {
      const now = new Date();
      const periods = this.getTimePeriods(now);

      const [thisWeek, thisMonth, thisYear] = await Promise.all([
        this.getCurrentPeriodData(periods.find(p => p[0] === 'weekly')![1], 'weekly'),
        this.getCurrentPeriodData(periods.find(p => p[0] === 'monthly')![1], 'monthly'),
        this.getCurrentPeriodData(periods.find(p => p[0] === 'yearly')![1], 'yearly')
      ]);

      return {
        thisWeek,
        thisMonth,
        thisYear
      };
    } catch (error) {
      console.error('Error fetching current period analytics:', error);
      return {
        thisWeek: null,
        thisMonth: null,
        thisYear: null
      };
    }
  },

  /**
   * Get current period data for a specific date key and period type
   */
  async getCurrentPeriodData(dateKey: string, period: string): Promise<AnalyticsData | null> {
    try {
      const analyticsRef = collection(db, 'analytics');
      const q = query(
        analyticsRef,
        where('period', '==', period),
        where('date', '==', dateKey)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          ...doc.data(),
          date: doc.data().date,
          lost: doc.data().lost || 0,
          found: doc.data().found || 0,
          total: doc.data().total || 0,
          period: doc.data().period
        } as AnalyticsData;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching current ${period} data for ${dateKey}:`, error);
      return null;
    }
  }
};
