import type { GameFeedback } from './directus';

/**
 * Format price to USD string
 * @example formatPrice(9.99) => "$9.99"
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Format discount percentage
 * @example formatDiscount(50) => "-50%"
 */
export function formatDiscount(percent: number): string {
  return `-${Math.round(percent)}%`;
}

/**
 * Get Tailwind color classes for deck status badges
 */
export function getDeckBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    verified: 'badge-verified',
    playable: 'badge-playable',
    unsupported: 'badge-unsupported',
    unknown: 'bg-zinc-800 text-zinc-400',
  };
  return colors[status] || colors.unknown;
}

/**
 * Get Tailwind color classes for ProtonDB tier badges
 */
export function getProtonBadgeColor(tier: string): string {
  const colors: Record<string, string> = {
    platinum: 'bg-purple-900/50 text-purple-400 border border-purple-800',
    gold: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    silver: 'bg-zinc-700/50 text-zinc-300 border border-zinc-600',
    bronze: 'bg-orange-900/50 text-orange-400 border border-orange-800',
    borked: 'bg-red-900/50 text-red-400 border border-red-800',
    unknown: 'bg-zinc-800 text-zinc-400',
  };
  return colors[tier] || colors.unknown;
}

/**
 * Get human-readable store name
 */
export function getStoreName(store: string): string {
  const stores: Record<string, string> = {
    steam: 'Steam',
    gog: 'GOG',
    epic: 'Epic Games',
    humble: 'Humble Bundle',
    gmg: 'Green Man Gaming',
    fanatical: 'Fanatical',
  };
  return stores[store] || store;
}

/**
 * Calculate days remaining until a date
 */
export function getDaysRemaining(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format date to relative string
 * @example "2 days ago", "in 3 days"
 */
export function formatRelativeDate(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 1) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Aggregate feedback statistics
 */
export function getFeedbackStats(feedbacks: GameFeedback[]) {
  if (!feedbacks || feedbacks.length === 0) {
    return null;
  }

  const total = feedbacks.length;
  const runsWell = feedbacks.filter(f => f.runs_well === true).length;
  const batteryAccurate = feedbacks.filter(f => f.battery_accurate === true).length;
  const controlsGood = feedbacks.filter(f => f.controls_good === true).length;

  return {
    total,
    runsWellPercent: Math.round((runsWell / total) * 100),
    batteryAccuratePercent: Math.round((batteryAccurate / total) * 100),
    controlsGoodPercent: Math.round((controlsGood / total) * 100),
  };
}