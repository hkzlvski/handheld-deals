import { createDirectus, rest, readItems, readItem } from '@directus/sdk';

// Device Performance Interface (NEW v3.0)
export interface DevicePerformance {
  steam_deck?: {
    status: 'excellent' | 'good' | 'playable' | 'poor' | 'untested' | 'estimated';
    fps_avg?: number | null;
    battery_hours?: number | null;
    tested_settings?: string | null;
    tested_date?: string | null;
    notes?: string | null;
    estimated?: boolean;
  };
  rog_ally?: {
    status: 'excellent' | 'good' | 'playable' | 'poor' | 'untested' | 'estimated';
    fps_avg?: number | null;
    battery_hours?: number | null;
    tested_settings?: string | null;
    tested_date?: string | null;
    notes?: string | null;
    estimated?: boolean;
  };
  legion_go?: {
    status: 'excellent' | 'good' | 'playable' | 'poor' | 'untested' | 'estimated';
    fps_avg?: number | null;
    battery_hours?: number | null;
    tested_settings?: string | null;
    tested_date?: string | null;
    notes?: string | null;
    estimated?: boolean;
  };
}

// Game Interface (UPDATED v3.0)
export interface Game {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  steam_app_id: number | null;

  // Compatibility
  deck_status: 'verified' | 'playable' | 'unsupported' | 'unknown';
  protondb_tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | 'unknown';
  controller_support: 'full' | 'partial' | 'none' | 'unknown';

  // Technical
  launcher: 'steam' | 'gog' | 'epic' | 'ea' | 'ubisoft' | 'rockstar' | 'none' | null;
  always_online: boolean | null;
  cloud_save: boolean | null;

  // Metadata
  genre: string[] | null;  // CHANGED: now array
  release_year: number | null;
  metacritic_score: number | null;
  steam_positive_percent: number | null;
  steam_total_reviews: number | null;  // Directus field name


  // NEW v3.0 Fields
  best_for: string[] | null;  // Context tags
  avoid_if: string[] | null;  // Warning tags
  data_reliability: 'hand_tested' | 'community_verified' | 'estimated_api' | 'stale_tested' | null;
  device_performance: DevicePerformance | null;

  // Legacy (keep for backwards compatibility but optional)
  manual_quality_override?: boolean | null;
  notes?: string | null;

  // Timestamps
  date_created?: string;
  date_updated?: string;
}

// Deal Interface (unchanged)
export interface Deal {
  id: string;
  game_id: string | Game;
  store: 'steam' | 'gog' | 'humble' | 'gmg' | 'fanatical';
  price: number;
  normal_price: number;
  discount_percent: number;
  url: string;
  is_historical_low: boolean;
  cheapest_price_ever: number | null;
  last_checked: string;
  expires_at: string | null;
  date_created?: string;
}

// Collection Interface (unchanged)
export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number | null;
  status: 'published' | 'draft' | 'archived';
  date_created?: string;
}

// Event Interface (unchanged)
export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: 'steam_sale' | 'publisher_sale' | 'seasonal' | 'other';
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'ended';
  banner_url: string | null;
  date_created?: string;
}

// Curator Pick Interface (NEW v3.0)
export interface CuratorPick {
  id: string;
  game_id: string | Game;
  week_number: number;
  score: number;
  curator_note: string;
  fps_avg: number | null;
  battery_hours: number | null;
  controls_rating: number | null;
  verdict: 'buy' | 'wait' | 'skip';
  tested_on: 'deck' | 'ally' | 'legion';
  published_at: string | null;
  status: 'draft' | 'published';

  // NEW v3.0
  curator_veto: boolean | null;
  curator_veto_reason: string | null;
  context_tags: string[] | null;
  warning_tags: string[] | null;
  confidence_level: 'high' | 'medium' | 'low' | null;
  last_verified: string | null;

  date_created?: string;
}

// Price Alert Interface (NEW v3.0)
export interface PriceAlert {
  id: string;
  game_id: string | Game;
  email: string;
  target_price: number;
  current_price: number | null;
  device_context: string | null;
  alert_sent: boolean;
  alert_sent_at: string | null;
  verified: boolean;
  verification_token: string | null;
  expires_at: string | null;
  date_created?: string;
}

// Define the schema structure
interface Schema {
  games: Game[];
  deals: Deal[];
  collections: Collection[];
  events: Event[];
  curator_picks: CuratorPick[];
  price_alerts: PriceAlert[];
}

// Get API URL from environment
const DIRECTUS_URL = import.meta.env.PUBLIC_DIRECTUS_URL || 'http://localhost:8055';

// Create Directus client
export const directus = createDirectus<Schema>(DIRECTUS_URL).with(rest());

// Export helper functions
export { readItems, readItem };