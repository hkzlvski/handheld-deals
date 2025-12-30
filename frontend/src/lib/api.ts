import { directus, readItems, type Game, type Deal } from './directus';

/**
 * Get Deal of the Day
 * Priority: Highest discount with Deck Verified status
 */
export async function getDealOfTheDay() {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gte: 60 }  // Only big discounts for DOTD
        } as any,
        sort: ['-discount_percent'],
        limit: 10,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // Prefer Deck Verified games
    const verifiedDeal = deals.find((d: any) =>
      d.game_id && d.game_id.deck_status === 'verified'
    );

    return verifiedDeal || deals[0] || null;
  } catch (error) {
    console.error('Error fetching Deal of the Day:', error);
    return null;
  }
}

/**
 * Get Deck Verified Deals
 * Games confirmed to work well on Steam Deck
 */
export async function getDeckVerifiedDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gt: 0 }
        } as any,
        sort: ['-discount_percent'],
        limit: 100,  // Fetch more, filter in JS
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // Filter in JavaScript instead of Directus query
    const verifiedDeals = deals
      .filter((d: any) =>
        d.game_id &&
        d.game_id.deck_status &&
        ['verified', 'playable'].includes(d.game_id.deck_status)
      )
      .slice(0, limit);

    return verifiedDeals;
  } catch (error) {
    console.error('Error fetching Deck Verified deals:', error);
    return [];
  }
}

/**
 * Get Battery Saver Deals
 * Games with 4+ hours battery life on Steam Deck
 */
export async function getBatterySaverDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gt: 0 }
        } as any,
        sort: ['-discount_percent'],
        limit: 100,  // Fetch many, filter by battery
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // Filter by Steam Deck battery >= 4 hours
    const batterySavers = deals.filter((d: any) => {
      if (!d.game_id || !d.game_id.device_performance) return false;

      const deckPerf = d.game_id.device_performance.steam_deck;
      if (!deckPerf || !deckPerf.battery_hours) return false;

      return deckPerf.battery_hours >= 4.0;
    });

    return batterySavers.slice(0, limit);
  } catch (error) {
    console.error('Error fetching Battery Saver deals:', error);
    return [];
  }
}

/**
 * Get Top Discount Deals
 * Highest discounts regardless of compatibility
 */
export async function getTopDiscountDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gte: 50 }  // 50%+ discounts only
        } as any,
        sort: ['-discount_percent'],
        limit,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    return deals.filter((d: any) => d.game_id);
  } catch (error) {
    console.error('Error fetching Top Discount deals:', error);
    return [];
  }
}

/**
 * Get Mission Stats for homepage
 */
export async function getMissionStats() {
  try {
    const [deals, games] = await Promise.all([
      directus.request(
        readItems('deals', {
          fields: ['normal_price', 'price', 'expires_at'],
          limit: -1
        })
      ),
      directus.request(
        readItems('games', {
          fields: ['deck_status', 'date_updated'],
          limit: -1
        })
      )
    ]);

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Active deals (not expired)
    const activeDeals = (deals as any[]).filter((d: any) => {
      if (!d.expires_at) return true; // No expiry = always active
      return new Date(d.expires_at) > today;
    }).length;

    // New verified games this week
    const newVerified = (games as any[]).filter((g: any) =>
      g.deck_status === 'verified' &&
      g.date_updated &&
      new Date(g.date_updated) >= weekAgo
    ).length;

    // Total potential savings
    const potentialSavings = (deals as any[]).reduce((sum: number, d: any) =>
      sum + (d.normal_price - d.price), 0
    );

    return {
      activeDeals,
      newVerified,
      potentialSavings: Math.round(potentialSavings)
    };
  } catch (error) {
    console.error('Error fetching mission stats:', error);
    return {
      activeDeals: 0,
      newVerified: 0,
      potentialSavings: 0
    };
  }
}

/**
 * Helper: Get average battery life for a game
 */
export function getAverageBatteryLife(game: Game): number | null {
  if (!game.device_performance) return null;

  const batteries: number[] = [];

  if (game.device_performance.steam_deck?.battery_hours) {
    batteries.push(game.device_performance.steam_deck.battery_hours);
  }
  if (game.device_performance.rog_ally?.battery_hours) {
    batteries.push(game.device_performance.rog_ally.battery_hours);
  }
  if (game.device_performance.legion_go?.battery_hours) {
    batteries.push(game.device_performance.legion_go.battery_hours);
  }

  if (batteries.length === 0) return null;

  return batteries.reduce((sum, b) => sum + b, 0) / batteries.length;
}

/**
 * Helper: Get best performing device for a game
 */
export function getBestDevice(game: Game): 'steam_deck' | 'rog_ally' | 'legion_go' | null {
  if (!game.device_performance) return null;

  const devices = [
    { name: 'steam_deck' as const, perf: game.device_performance.steam_deck },
    { name: 'rog_ally' as const, perf: game.device_performance.rog_ally },
    { name: 'legion_go' as const, perf: game.device_performance.legion_go }
  ];

  // Filter untested/poor devices
  const viable = devices.filter(d =>
    d.perf && ['excellent', 'good', 'playable'].includes(d.perf.status)
  );

  if (viable.length === 0) return null;

  // Sort by FPS if available, otherwise by battery
  viable.sort((a, b) => {
    const aFps = a.perf?.fps_avg || 0;
    const bFps = b.perf?.fps_avg || 0;

    if (aFps !== bFps) return bFps - aFps;

    const aBatt = a.perf?.battery_hours || 0;
    const bBatt = b.perf?.battery_hours || 0;

    return bBatt - aBatt;
  });

  return viable[0].name;
}