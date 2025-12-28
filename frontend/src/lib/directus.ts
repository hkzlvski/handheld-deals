import { createDirectus, rest, readItems, readItem } from '@directus/sdk';

// Define your Directus schema types
export interface Game {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  steam_app_id: number;
  deck_status: 'verified' | 'playable' | 'unsupported' | 'unknown';
  protondb_tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | 'unknown';
  controller_support: 'full' | 'partial' | 'none' | 'unknown';
  launcher: 'steam' | 'gog' | 'epic' | 'other';
  always_online: boolean;
  offline_playable: boolean;
  battery_drain: 'low' | 'medium' | 'high';
  cloud_save: boolean;
  small_text_warning: boolean;
  anti_cheat_issues: boolean;
  genres: string | null;
  release_year: number | null;
  metacritic_score: number | null;
  steam_positive_percent: number | null;
  steam_total_reviews: number | null;
  manual_quality_override: boolean | null;
  notes: string | null;
  handheld_performance: string | null;
  popularity_score: number;
  last_deal_date: string | null;
  date_created: string;
  date_updated: string;
}

export interface Deal {
  id: string;
  game_id: string | Game;
  store: 'steam' | 'gog' | 'epic' | 'humble' | 'gmg' | 'fanatical';
  price: number;
  normal_price: number;
  discount_percent: number;
  url: string;
  is_historical_low: boolean;
  cheapest_price_ever: number;
  deal_rating: number | null;
  last_checked: string;
  expires_at: string | null;
  date_created: string;
}

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  sort_order: number | null;
  date_created: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: 'sale' | 'launch' | 'announcement';
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'ended';
  cover_image_url: string | null;
  external_url: string | null;
  date_created: string;
}

export interface GameFeedback {
  id: string;
  game_id: string;
  user_identifier: string;
  runs_well: boolean | null;
  battery_accurate: boolean | null;
  controls_good: boolean | null;
  notes: string | null;
  date_created: string;
}

export interface EditorialOverride {
  id: string;
  game_id: string;
  editor_notes: string | null;
  recommended: boolean;
  warning_message: string | null;
  date_created: string;
  date_updated: string;
}

// Define the schema structure
interface Schema {
  games: Game[];
  deals: Deal[];
  collections: Collection[];
  events: Event[];
  game_feedback: GameFeedback[];
  editorial_overrides: EditorialOverride[];
}

// Get API URL from environment
const DIRECTUS_URL = import.meta.env.PUBLIC_DIRECTUS_URL || 'http://localhost:8055';

// Create Directus client
export const directus = createDirectus<Schema>(DIRECTUS_URL).with(rest());

// Export helper functions
export { readItems, readItem };