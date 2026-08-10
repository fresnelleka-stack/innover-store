import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type Product = {
  id: string;
  sku: string;
  name: string;
  category: 'phone' | 'accessory' | 'other';
  imei?: string;
  cost_xaf: number;
  selling_price_xaf: number;
  quantity_available: number;
  quantity_sold: number;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  id: string;
  product_id: string;
  imei?: string;
  quantity: number;
  unit_price_xaf: number;
  total_price_xaf: number;
  profit_xaf: number;
  seller_id: string;
  seller_name: string;
  sold_at: string;
  receipt_number?: string;
  notes?: string;
};
