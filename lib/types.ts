// Product/Article types
export interface Product {
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
}

// Stock History
export interface StockEntry {
  id: string;
  product_id: string;
  quantity: number;
  type: 'in' | 'out' | 'adjustment';
  notes?: string;
  created_at: string;
}

// Sale Record
export interface Sale {
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
}

// User/Employee
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'seller';
  created_at: string;
}

// Daily Report
export interface DailyReport {
  date: string;
  total_sales: number;
  total_revenue_xaf: number;
  total_profit_xaf: number;
  items_sold: number;
  stock_remaining: number;
}
