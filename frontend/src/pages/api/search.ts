import type { APIRoute } from 'astro';
import { directus, readItems } from '../../lib/directus';

export const prerender = false; // ← KRYTYCZNE!

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q');
  const device = url.searchParams.get('device') || 'all';
  const limit = parseInt(url.searchParams.get('limit') || '8');

  console.log('🔍 Search API called - query:', query, 'device:', device); // DEBUG

  if (!query || query.length < 2) {
    console.log('⚠️ Query too short or missing');
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('📡 Fetching from Directus with query:', query); // DEBUG

    // Fetch games matching query
    const games = await directus.request(
      readItems('games', {
        filter: {
          title: {
            _icontains: query.trim()
          }
        },
        fields: [
          'id',
          'title',
          'slug',
          'cover_image_url',
          'device_performance'
        ],
        limit: limit,
        sort: ['title']
      })
    );

    console.log('✅ Games found:', games.length, games.map((g: any) => g.title)); // DEBUG

    // Fetch deals for each game
    const results = await Promise.all(
      games.map(async (game: any) => {
        const deals = await directus.request(
          readItems('deals', {
            filter: { game_id: { _eq: game.id } },
            sort: ['price'],
            limit: 1
          })
        );

        const best_deal = deals[0] || null;

        return {
          id: game.id,
          title: game.title,
          slug: game.slug || game.title.toLowerCase().replace(/\s+/g, '-'),
          cover_image_url: game.cover_image_url,
          device_performance: game.device_performance,
          best_deal: best_deal ? {
            price: best_deal.price,
            normal_price: best_deal.normal_price,
            discount_percent: best_deal.discount_percent,
            store: best_deal.store
          } : null
        };
      })
    );

    console.log('📦 Final results:', results.length); // DEBUG

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Search API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        results: [],
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
