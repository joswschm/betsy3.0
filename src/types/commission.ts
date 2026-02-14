export interface Factory {
  id: string;
  name: string;
  display_name: string;
  format: 'excel' | 'pdf';
  created_at: string;
}

export interface Report {
  id: string;
  factory_id: string;
  filename: string;
  report_period: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  extracted_row_count: number;
  uploaded_at: string;
  processed_at: string | null;
  factory?: Factory;
}

export interface CommissionEntry {
  id?: string;
  report_id: string;
  factory_id: string;
  factory_name: string;
  customer_name: string | null;
  invoice_number: string | null;
  order_number: string | null;
  invoice_date: string | null;
  order_date: string | null;
  product_category: string | null;
  item_description: string | null;
  quantity: number | null;
  unit_price: number | null;
  sales_amount: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  region: string | null;
  is_split: boolean;
  split_with: string | null;
  split_amount: number | null;
  notes: string | null;
  raw_data: Record<string, unknown> | null;
  row_number: number | null;
  created_at?: string;
}

export interface HighlightedRow {
  rowNumber: number;
  cells: Record<string, string | number | null>;
}

export interface DashboardSummary {
  total_sales: number;
  total_commission: number;
  entry_count: number;
  report_count: number;
  by_factory: { factory_name: string; sales: number; commission: number; count: number }[];
  by_customer: { customer_name: string; sales: number; commission: number; count: number }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
