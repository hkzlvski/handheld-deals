/**
 * Time utility functions for deal expiration handling
 */

/**
 * Format time remaining for deal expiration
 * Returns human-readable string like "2h 30m" or "3d 12h"
 */
export function formatTimeRemaining(expiryDate: string | Date | null): string | null {
  if (!expiryDate) return null;

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();

  // Already expired
  if (diffMs <= 0) return 'Expired';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Check if deal is expired
 */
export function isDealExpired(expiryDate: string | Date | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() <= Date.now();
}

/**
 * Get urgency level for styling
 * Returns urgency based on time remaining
 */
export function getExpiryUrgency(
  expiryDate: string | Date | null
): 'critical' | 'warning' | 'normal' | null {
  if (!expiryDate) return null;

  const now = new Date();
  const expiry = new Date(expiryDate);
  const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining <= 0) return null; // Expired
  if (hoursRemaining < 6) return 'critical'; // Less than 6 hours - RED
  if (hoursRemaining < 24) return 'warning'; // Less than 24 hours - ORANGE
  return 'normal'; // More than 24 hours - BLUE
}

/**
 * Get formatted expiry date for tooltip
 */
export function formatExpiryDate(expiryDate: string | Date | null): string | null {
  if (!expiryDate) return null;

  const date = new Date(expiryDate);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}