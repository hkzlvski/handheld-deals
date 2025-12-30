import type { Game } from './directus';

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
    verified: 'bg-green-900/50 text-green-400 border border-green-800',
    playable: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    unsupported: 'bg-red-900/50 text-red-400 border border-red-800',
    unknown: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
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
    unknown: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
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
 * Get battery badge color based on hours
 * v3.0: Uses device_performance battery data
 */
export function getBatteryBadgeColor(hours: number): string {
  if (hours >= 6) return 'bg-green-900/50 text-green-400 border border-green-800';
  if (hours >= 4) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800';
  if (hours >= 2) return 'bg-orange-900/50 text-orange-400 border border-orange-800';
  return 'bg-red-900/50 text-red-400 border border-red-800';
}

/**
 * Format battery hours to readable string
 * @example formatBatteryHours(3.5) => "3.5h"
 * @example formatBatteryHours(2.8) => "~3h"
 */
export function formatBatteryHours(hours: number): string {
  if (hours % 1 === 0) {
    return `${hours}h`;
  }
  if (hours % 0.5 === 0) {
    return `${hours}h`;
  }
  return `~${Math.round(hours)}h`;
}

/**
 * Get device-specific battery life
 * v3.0: Reads from device_performance JSONB
 */
export function getDeviceBattery(
  game: Game,
  device: 'steam_deck' | 'rog_ally' | 'legion_go'
): number | null {
  if (!game.device_performance) return null;

  const devicePerf = game.device_performance[device];
  if (!devicePerf) return null;

  return devicePerf.battery_hours || null;
}

/**
 * Get device performance status
 */
export function getDeviceStatus(
  game: Game,
  device: 'steam_deck' | 'rog_ally' | 'legion_go'
): string {
  if (!game.device_performance) return 'untested';

  const devicePerf = game.device_performance[device];
  if (!devicePerf) return 'untested';

  return devicePerf.status || 'untested';
}

/**
 * Get device performance badge color
 */
export function getDeviceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    excellent: 'bg-green-900/50 text-green-400 border border-green-800',
    good: 'bg-blue-900/50 text-blue-400 border border-blue-800',
    playable: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    poor: 'bg-orange-900/50 text-orange-400 border border-orange-800',
    untested: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    estimated: 'bg-purple-900/50 text-purple-400 border border-purple-800',
  };
  return colors[status] || colors.untested;
}

/**
 * Format context tags to readable string
 * v3.0: best_for and avoid_if arrays
 */
export function formatContextTags(tags: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];

  const tagLabels: Record<string, string> = {
    travel: '✈️ Travel',
    couch_gaming: '🛋️ Couch',
    quick_sessions: '⚡ Quick Sessions',
    long_sessions: '🎯 Long Sessions',
    multiplayer: '👥 Multiplayer',
    single_player: '🎮 Single Player',
    offline: '📴 Offline',
    small_text: '⚠️ Small Text',
    always_online: '🌐 Always Online',
    requires_mouse: '🖱️ Mouse Required',
    heavy_graphics: '💪 Heavy Graphics',
    long_load_times: '⏳ Long Loads',
  };

  return tags.map(tag => tagLabels[tag] || tag);
}

/**
 * Get data reliability badge
 * v3.0: Shows data source confidence
 */
export function getDataReliabilityBadge(reliability: string | null): {
  text: string;
  color: string;
} {
  const badges: Record<string, { text: string; color: string }> = {
    hand_tested: {
      text: '✓ Hand Tested',
      color: 'bg-green-900/50 text-green-400 border border-green-800'
    },
    community_verified: {
      text: '👥 Community',
      color: 'bg-blue-900/50 text-blue-400 border border-blue-800'
    },
    estimated_api: {
      text: '📊 Estimated',
      color: 'bg-purple-900/50 text-purple-400 border border-purple-800'
    },
    stale_tested: {
      text: '⚠️ Needs Retest',
      color: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
    },
  };

  return badges[reliability || 'estimated_api'] || badges.estimated_api;
}

/**
 * Calculate discount rarity tier
 * Used for glow effects and badges
 */
export function getDiscountRarity(percent: number): 'legendary' | 'epic' | 'rare' | 'common' {
  if (percent >= 75) return 'legendary';
  if (percent >= 60) return 'epic';
  if (percent >= 40) return 'rare';
  return 'common';
}

/**
 * Get rarity glow class for deals
 */
export function getRarityGlowClass(percent: number): string {
  const rarity = getDiscountRarity(percent);
  const glows: Record<string, string> = {
    legendary: 'shadow-glow-legendary border-rarity-legendary',
    epic: 'shadow-glow-epic border-rarity-epic',
    rare: 'shadow-glow-rare border-rarity-rare',
    common: 'shadow-glow-common border-rarity-common',
  };
  return glows[rarity];
}