import { directus, readItems, type Game, type Deal } from './directus';

type DeviceType = 'all' | 'steam_deck' | 'rog_ally' | 'legion_go';

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
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // Filter by device compatibility
    const compatibleDeals = deals.filter((d: any) => {
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

    return compatibleDeals[0] || deals[0] || null;
  } catch (error) {
    console.error('Error fetching Deal of the Day:', error);
    return null;
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
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    let filtered;

    if (device === 'all') {
      // Show Deck verified/playable
      filtered = deals.filter((d: any) =>
        d.game_id &&
        d.game_id.deck_status &&
        ['verified', 'playable'].includes(d.game_id.deck_status)
      );
    } else {
      // Show excellent performance on selected device
      filtered = deals.filter((d: any) => {
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
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // Default to Steam Deck if 'all' selected
    const targetDevice = device === 'all' ? 'steam_deck' : device;

    const batterySavers = deals.filter((d: any) => {
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
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    if (device === 'all') {
      return deals.slice(0, limit);
    }

    // Filter by device compatibility
    const compatible = deals.filter((d: any) => {
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

    const activeDeals = (deals as any[]).filter((d: any) => {
      if (!d.expires_at) return true;
      return new Date(d.expires_at) > today;
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