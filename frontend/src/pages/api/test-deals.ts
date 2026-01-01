import type { APIRoute } from 'astro';
import { getDeckVerifiedDeals } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async () => {
  const deals = await getDeckVerifiedDeals(5, 'all');

  return new Response(JSON.stringify({
    count: deals.length,
    deals: deals,
    first_deal_keys: deals[0] ? Object.keys(deals[0]) : []
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
