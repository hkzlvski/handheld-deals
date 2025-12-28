import { directus, readItems } from './directus';

export async function getDealOfTheDay() {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: { discount_percent: { _gte: 20 } } as any,
        sort: ['-discount_percent'],
        limit: 1,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );
    return deals[0] || null;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

export async function getDeckVerifiedDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        sort: ['-discount_percent'],
        limit: 50,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // TEMPORARY: Show all deals with discount, not just verified
    return deals
      .filter((d: any) => d.game_id && d.discount_percent > 0)
      .slice(0, limit);
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

export async function getBatterySaverDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        sort: ['-discount_percent'],
        limit: 50,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );

    // TEMPORARY: Show random deals, not just low battery
    return deals
      .filter((d: any) => d.game_id && d.discount_percent > 0)
      .slice(0, limit);
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

export async function getTopDiscountDeals(limit = 12) {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        filter: { discount_percent: { _gt: 0 } } as any,
        sort: ['-discount_percent'],
        limit,
        fields: ['*', { game_id: ['*'] }] as any
      })
    );
    return deals;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

export async function getMissionStats() {
  try {
    const deals: any = await directus.request(
      readItems('deals', {
        fields: ['normal_price', 'price', 'expires_at'],
        limit: -1
      })
    );

    const games: any = await directus.request(
      readItems('games', {
        fields: ['deck_status', 'date_updated'],
        limit: -1
      })
    );

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeDeals = deals.filter((d: any) =>
      d.expires_at && new Date(d.expires_at) <= today
    ).length;

    const newVerified = games.filter((g: any) =>
      g.deck_status === 'verified' &&
      g.date_updated &&
      new Date(g.date_updated) >= weekAgo
    ).length;

    const potentialSavings = deals.reduce((sum: number, d: any) =>
      sum + (d.normal_price - d.price), 0
    );

    return {
      activeDeals,
      newVerified,
      potentialSavings: Math.round(potentialSavings)
    };
  } catch (error) {
    console.error('Error:', error);
    return { activeDeals: 0, newVerified: 0, potentialSavings: 0 };
  }
}