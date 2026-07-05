export interface PaymentListItem {
  id: string;
  provider: string;
  status: string;
  amount: string;
  currency: string;
  gatewayReference: string | null;
  failureReason: string | null;
  createdAt: string;
  tenant: { name: string; slug: string };
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  tenant: { name: string; slug: string };
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
