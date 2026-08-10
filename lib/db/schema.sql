-- INNOVER STORE - Supabase Schema
-- Run this SQL in your Supabase project to set up the database

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'seller')) DEFAULT 'seller',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products/Articles table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('phone', 'accessory', 'other')) DEFAULT 'other',
  imei TEXT UNIQUE,
  cost_xaf DECIMAL(12,2) NOT NULL,
  selling_price_xaf DECIMAL(12,2) NOT NULL,
  quantity_available INTEGER DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Stock history (track all movements)
CREATE TABLE stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  type TEXT CHECK (type IN ('in', 'out', 'adjustment')) DEFAULT 'out',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sales records
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  imei TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price_xaf DECIMAL(12,2) NOT NULL,
  total_price_xaf DECIMAL(12,2) NOT NULL,
  profit_xaf DECIMAL(12,2) NOT NULL,
  seller_id UUID REFERENCES users(id),
  seller_name TEXT,
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  receipt_number TEXT,
  notes TEXT
);

-- Create indexes for faster queries
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_imei ON products(imei);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_sold_at ON sales(sold_at);
CREATE INDEX idx_sales_seller_id ON sales(seller_id);
CREATE INDEX idx_stock_entries_product_id ON stock_entries(product_id);

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "allow_all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stock_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
