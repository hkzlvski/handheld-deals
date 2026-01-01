import { directus, readItems, type Game, type Deal } from './directus';

type DeviceType = 'all' | 'steam_deck' | 'rog_ally' | 'legion_go';

/**
 * Filter out expired deals
 */
function filterExpiredDeals(deals: any[]): any[] {
  const now = new Date();
  return deals.filter(deal => {
    if (!deal.expiry_date) return true; // No expiry = always valid
    return new Date(deal.expiry_date) > now;
  });
}

/**
 * Get Deal of the Day (v3.0 - device-aware)
 * Priority: Editorial override > Highest discount with device compatibility
 */
export async function getDealOfTheDay(device: DeviceType = 'all') {
  try {
    // TODO: Check editorial_overrides for force_deal_of_day when collection exists

    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gte: 60 }  // Big discounts only
        } as any,
        sort: ['-discount_percent'],
        limit: 50,
        fields: [
          'id',
          'game_id',
          'store',
          'price',
          'normal_price',
          'discount_percent',
          'url',
          'is_historical_low',
          'expiry_date',
          { game_id: ['*'] }
        ] as any
      })
    );

    // Filter out expired deals FIRST
    const activeDeals = filterExpiredDeals(deals);

    // Filter by device compatibility
    const compatibleDeals = activeDeals.filter((d: any) => {
      if (!d.game_id || !d.game_id.device_performance) return false;

      if (device === 'all') return true;

      const devicePerf = d.game_id.device_performance[device];
      if (!devicePerf) return false;

      // Must be at least playable
      return ['excellent', 'good', 'playable'].includes(devicePerf.status);
    });

    // Prefer Deck Verified for 'all'
    if (device === 'all') {
      const verifiedDeal = compatibleDeals.find((d: any) =>
        d.game_id && d.game_id.deck_status === 'verified'
      );
      if (verifiedDeal) return verifiedDeal;
    }

    return compatibleDeals[0] || activeDeals[0] || null;
  } catch (error) {
    console.error('Error fetching Deal of the Day:', error);
    return null;
  }
}

/**
 * Get Weekly Gems (v3.0 - curator picks)
 * Latest hand-tested game reviews
 */
export async function getWeeklyGems(limit: number = 5) {
  try {
    const picks: any = await directus.request(
      readItems('curator_picks', {
        filter: {
          status: { _eq: 'published' }
        } as any,
        sort: ['-published_at'],
        limit,
        fields: [
          '*',
          {
            game_id: [
              'id',
              'title',
              'slug',
              'cover_image_url',
              'device_performance',
              'deck_status',
              'controller_support'
            ]
          }
        ] as any
      })
    );

    return picks || [];
  } catch (error) {
    console.error('Error fetching weekly gems:', error);
    return [];
  }
}

/**
 * Get Deck Verified Deals (v3.0 - device-aware)
 * For specific device: excellent status
 * For 'all': verified/playable deck_status
 */
export async function getDeckVerifiedDeals(limit = 12, device: DeviceType = 'all') {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gt: 0 }
        } as any,
        sort: ['-discount_percent'],
        limit: 100,
        fields: [
          'id',
          'game_id',
          'store',
          'price',
          'normal_price',
          'discount_percent',
          'url',
          'is_historical_low',
          'expiry_date',
          { game_id: ['*'] }
        ] as any
      })
    );

    // Filter out expired deals FIRST
    const activeDeals = filterExpiredDeals(deals);

    let filtered;

    if (device === 'all') {
      // Show Deck verified/playable
      filtered = activeDeals.filter((d: any) =>
        d.game_id &&
        d.game_id.deck_status &&
        ['verified', 'playable'].includes(d.game_id.deck_status)
      );
    } else {
      // Show excellent performance on selected device
      filtered = activeDeals.filter((d: any) => {
        if (!d.game_id || !d.game_id.device_performance) return false;
        const devicePerf = d.game_id.device_performance[device];
        return devicePerf && devicePerf.status === 'excellent';
      });
    }

    return filtered.slice(0, limit);
  } catch (error) {
    console.error('Error fetching Deck Verified deals:', error);
    return [];
  }
}

/**
 * Get Battery Saver Deals (v3.0 - device-specific)
 * Games with 5+ hours battery on selected device
 */
export async function getBatterySaverDeals(limit = 12, device: DeviceType = 'steam_deck') {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gt: 0 }
        } as any,
        sort: ['-discount_percent'],
        limit: 100,
        fields: [
          'id',
          'game_id',
          'store',
          'price',
          'normal_price',
          'discount_percent',
          'url',
          'is_historical_low',
          'expiry_date',
          { game_id: ['*'] }
        ] as any
      })
    );

    // Filter out expired deals FIRST
    const activeDeals = filterExpiredDeals(deals);

    // Default to Steam Deck if 'all' selected
    const targetDevice = device === 'all' ? 'steam_deck' : device;

    const batterySavers = activeDeals.filter((d: any) => {
      if (!d.game_id || !d.game_id.device_performance) return false;

      const devicePerf = d.game_id.device_performance[targetDevice];
      if (!devicePerf || !devicePerf.battery_hours) return false;

      return devicePerf.battery_hours >= 5.0;
    });

    return batterySavers.slice(0, limit);
  } catch (error) {
    console.error('Error fetching Battery Saver deals:', error);
    return [];
  }
}

/**
 * Get Top Discount Deals (v3.0 - device-aware)
 * Highest discounts that work on selected device
 */
export async function getTopDiscountDeals(limit = 12, device: DeviceType = 'all') {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: {
          discount_percent: { _gte: 50 }
        } as any,
        sort: ['-discount_percent'],
        limit: 100,
        fields: [
          'id',
          'game_id',
          'store',
          'price',
          'normal_price',
          'discount_percent',
          'url',
          'is_historical_low',
          'expiry_date',
          { game_id: ['*'] }
        ] as any
      })
    );

    // Filter out expired deals FIRST
    const activeDeals = filterExpiredDeals(deals);

    if (device === 'all') {
      return activeDeals.slice(0, limit);
    }

    // Filter by device compatibility
    const compatible = activeDeals.filter((d: any) => {
      if (!d.game_id || !d.game_id.device_performance) return true; // Include unknowns

      const devicePerf = d.game_id.device_performance[device];
      if (!devicePerf) return true;

      // Exclude poor/untested
      return !['poor', 'untested'].includes(devicePerf.status);
    });

    return compatible.slice(0, limit);
  } catch (error) {
    console.error('Error fetching Top Discount deals:', error);
    return [];
  }
}

/**
 * Get Mission Stats (updated for v3.0)
 */
export async function getMissionStats() {
  try {
    const [deals, games] = await Promise.all([
      directus.request(
        readItems('deals', {
          fields: ['normal_price', 'price', 'expiry_date'],
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

    const activeDeals = (deals as any[]).filter((d: any) => {
      if (!d.expiry_date) return true;
      return new Date(d.expiry_date) > today;
    }).length;

    const newVerified = (games as any[]).filter((g: any) =>
      g.deck_status === 'verified' &&
      g.date_updated &&
      new Date(g.date_updated) >= weekAgo
    ).length;

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
 * Helper: Get device-specific battery life
 */
export function getDeviceBattery(
  game: Game,
  device: 'steam_deck' | 'rog_ally' | 'legion_go'
): number | null {
  if (!game.device_performance) return null;
  const devicePerf = game.device_performance[device];
  return devicePerf?.battery_hours || null;
}

/**
 * Helper: Get device performance status
 */
export function getDeviceStatus(
  game: Game,
  device: 'steam_deck' | 'rog_ally' | 'legion_go'
): string {
  if (!game.device_performance) return 'untested';
  const devicePerf = game.device_performance[device];
  return devicePerf?.status || 'untested';
}

/**
 * Search games by title
 * Device-aware: filters by compatibility status
 */
export async function searchGames(
  query: string,
  device: string = "all",
  limit: number = 8
): Promise<any[]> {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Fetch all games matching search query
    const games = await directus.request(
      readItems("games", {
        filter: {
          title: {
            _icontains: query.trim(),
          },
        },
        fields: [
          "id",
          "title",
          "slug",
          "cover_image_url",
          "device_performance",
          "deck_status",
          "protondb_tier",
        ],
        limit: 50, // Fetch more, filter in JS
        sort: ["title"],
      })
    );

    // Get best deal for each game
    const gamesWithDeals = await Promise.all(
      games.map(async (game: any) => {
        const deals = await directus.request(
          readItems("deals", {
            filter: {
              game_id: { _eq: game.id },
            },
            sort: ["price"],
            limit: 1,
          })
        );

        const bestDeal = deals?.[0] || null;

        return {
          ...game,
          best_deal: bestDeal,
        };
      })
    );

    // Filter by device compatibility (client-side)
    let filtered = gamesWithDeals;

    if (device !== "all") {
      filtered = gamesWithDeals.filter((game: any) => {
        const perf = game.device_performance?.[device];
        const status = perf?.status;
        // Include excellent and playable, exclude poor and untested
        return status === "excellent" || status === "playable";
      });
    }

    // Sort by relevance (exact match first, then alphabetical)
    const queryLower = query.toLowerCase();
    filtered.sort((a: any, b: any) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();

      // Exact match first
      const aExact = aTitle === queryLower;
      const bExact = bTitle === queryLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Starts with query
      const aStarts = aTitle.startsWith(queryLower);
      const bStarts = bTitle.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Alphabetical
      return aTitle.localeCompare(bTitle);
    });

    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Error searching games:", error);
    return [];
  }
}