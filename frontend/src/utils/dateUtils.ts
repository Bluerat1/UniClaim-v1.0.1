/**
 * Utility functions for handling and formatting dates and timestamps
 */

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

type DateInput = Date | number | string | FirebaseTimestamp;

/**
 * Converts various date formats to a JavaScript Date object
 */
function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  if (typeof input === 'string') return new Date(input);
  if (input && typeof input === 'object' && 'seconds' in input) {
    return new Date(input.seconds * 1000 + Math.floor(input.nanoseconds / 1000000));
  }
  return new Date();
}

/**
 * Formats a date to a localized date and time string
 * @example "Oct 29, 2025, 11:06 AM"
 */
export function formatDateTime(date: DateInput): string {
  const d = toDate(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats a date to a relative time string
 * @example "2 hours ago", "yesterday", "3 days ago"
 */
export function formatRelativeTime(date: DateInput): string {
  const d = toDate(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  // Less than a minute
  if (diffInSeconds < 60) return 'just now';
  
  // Less than an hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  
  // Less than a day
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }
  
  // Less than a week
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? 'yesterday' : `${diffInDays} days ago`;
  }
  
  // Otherwise, return the full date
  return formatDateTime(d);
}

/**
 * Formats a date to a date-only string
 * @example "October 29, 2025"
 */
export function formatDate(date: DateInput): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a date to a time-only string
 * @example "11:06 AM"
 */
export function formatTime(date: DateInput): string {
  const d = toDate(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Converts a Firebase timestamp to a JavaScript Date object
 */
export function firebaseTimestampToDate(timestamp: FirebaseTimestamp): Date {
  return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
}

/**
 * Gets the time difference between two dates in a human-readable format
 * @example "2h 30m" or "1d 4h" or "3d 2h"
 */
export function getTimeDifference(start: DateInput, end: DateInput = new Date()): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  
  const diffInMs = endDate.getTime() - startDate.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) {
    const remainingHours = diffInHours % 24;
    return `${diffInDays}d${remainingHours ? ` ${remainingHours}h` : ''}`;
  }
  
  if (diffInHours > 0) {
    const remainingMinutes = diffInMinutes % 60;
    return `${diffInHours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
  }
  
  return `${diffInMinutes}m`;
}
