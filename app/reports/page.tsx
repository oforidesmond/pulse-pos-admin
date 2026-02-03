'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ClipboardList, Download, Info, Loader2, Package, Search, ShoppingBag, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
}

interface ProductsResponse {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type Adjustment = {
  id: string;
  type: string;
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  reason: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string | null;
    username: string | null;
  } | null;
};

type SaleActivity = {
  id: string;
  saleId: string;
  receiptNumber: string;
  paymentMethod: string | null;
  quantity: number;
  price: number;
  total: number;
  createdAt: string | null;
  userId: string | null;
  attendant: {
    id: string;
    fullName: string | null;
    username: string | null;
  } | null;
};

type DetailedReportResponse = {
  product: Product;
  adjustments: Adjustment[];
  sales: SaleActivity[];
};

const adjustmentLabels: Record<string, string> = {
  INITIAL_STOCK: 'Initial Stock',
  SUPPLIER_ADD: 'Supplier Add',
  DAMAGE_EXPIRED_REMOVE: 'Damage/Expired',
  BULK_TO_SINGLES: 'Bulk -> Singles',
  SINGLES_TO_BULK: 'Singles -> Bulk',
  CORRECT_ENTRY_ERROR: 'Correct Entry Error',
  SALE: 'Sale',
  SALE_REVERSAL: 'Sale Reversal',
};

const currencyFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace('GHS', '₵').trim();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQuantity(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value.toFixed(2))}`;
}

function formatCsvNumber(value: number) {
  return Number(value.toFixed(2));
}

function escapeCsvValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  if (typeof window === 'undefined') {
    return;
  }
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function DetailedReportsPage() {
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);

  const adjustmentsPageSize = 25;
  const salesPageSize = 25;

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
      setProductPage(1);
    }, 300);

    return () => {
      window.clearTimeout(handler);
    };
  }, [productSearch]);

  const {
    data: productsData,
    isPending: isProductsPending,
    isError: isProductsError,
  } = useQuery<ProductsResponse, Error>({
    queryKey: ['report-products', productPage, debouncedProductSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(productPage));
      params.set('pageSize', '20');
      if (debouncedProductSearch) {
        params.set('search', debouncedProductSearch);
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load products.');
      }
      return (await response.json()) as ProductsResponse;
    },
    retry: 1,
  });

  const {
    data: reportData,
    isPending: isReportPending,
    isError: isReportError,
  } = useQuery<DetailedReportResponse, Error>({
    queryKey: ['detailed-report', selectedProductId, startDate, endDate],
    queryFn: async () => {
      if (!selectedProductId) {
        throw new Error('No product selected');
      }
      const params = new URLSearchParams();
      params.set('productId', selectedProductId);
      if (startDate) {
        params.set('startDate', startDate);
      }
      if (endDate) {
        params.set('endDate', endDate);
      }

      const response = await fetch(`/api/reports/detailed?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load report.');
      }
      return (await response.json()) as DetailedReportResponse;
    },
    enabled: Boolean(selectedProductId),
    retry: 1,
  });

  const products = productsData?.products ?? [];
  const productTotalPages = productsData?.totalPages ?? 1;
  const selectedProduct = reportData?.product ?? products.find((product) => product.id === selectedProductId) ?? null;
  const adjustments = reportData?.adjustments ?? [];
  const sales = reportData?.sales ?? [];

  useEffect(() => {
    setAdjustmentsPage(1);
    setSalesPage(1);
  }, [selectedProductId, startDate, endDate]);

  const totalAdjustments = adjustments.length;
  const netUnitsSold = sales.reduce((sum, item) => sum + item.quantity, 0);
  const netSalesValue = sales.reduce((sum, item) => sum + item.total, 0);
  const lastActivityDate = useMemo(() => {
    const dates: string[] = [];
    adjustments.forEach((adjustment) => dates.push(adjustment.createdAt));
    sales.forEach((sale) => {
      if (sale.createdAt) {
        dates.push(sale.createdAt);
      }
    });
    if (dates.length === 0) {
      return null;
    }
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [adjustments, sales]);

  const isEmptyReport = !isReportPending && !isReportError && selectedProduct && adjustments.length === 0 && sales.length === 0;
  const exportFileSuffix = useMemo(() => {
    const name = selectedProduct?.name ?? 'product';
    const suffixParts = [name, startDate || 'all', endDate || 'all']
      .filter(Boolean)
      .join('-')
      .replace(/[^a-z0-9-]+/gi, '-');
    return suffixParts.toLowerCase();
  }, [selectedProduct, startDate, endDate]);

  const handleExportAdjustments = () => {
    if (!selectedProduct) {
      return;
    }
    const rows: Array<Array<string | number | null | undefined>> = [
      ['Product', 'SKU', 'Date', 'Type', 'Change', 'Before', 'After', 'Recorded By', 'Reason'],
      ...adjustments.map((adjustment) => [
        selectedProduct.name,
        selectedProduct.sku || '',
        formatDateTime(adjustment.createdAt),
        adjustmentLabels[adjustment.type] ?? adjustment.type,
        formatQuantity(adjustment.quantityChange),
        formatCsvNumber(adjustment.quantityBefore),
        formatCsvNumber(adjustment.quantityAfter),
        adjustment.user?.fullName || adjustment.user?.username || 'System',
        adjustment.type === 'CORRECT_ENTRY_ERROR' ? (adjustment.reason ?? '') : '',
      ]),
    ];

    downloadCsv(`stock-adjustments-${exportFileSuffix}.csv`, rows);
  };

  const handleExportSales = () => {
    if (!selectedProduct) {
      return;
    }
    const rows: Array<Array<string | number | null | undefined>> = [
      ['Product', 'SKU', 'Date', 'Receipt', 'Type', 'Quantity', 'Total', 'Attendant', 'Payment Method'],
      ...sales.map((sale) => {
        const isReversal = sale.receiptNumber.startsWith('REV-') || sale.quantity < 0;
        return [
          selectedProduct.name,
          selectedProduct.sku || '',
          formatDateTime(sale.createdAt),
          sale.receiptNumber,
          isReversal ? 'Reversal' : 'Sale',
          formatQuantity(sale.quantity),
          formatCsvNumber(sale.total),
          sale.attendant?.fullName || sale.attendant?.username || 'Walk-in',
          sale.paymentMethod ?? '',
        ];
      }),
    ];

    downloadCsv(`sales-activity-${exportFileSuffix}.csv`, rows);
  };

  const adjustmentsTotalPages = Math.max(1, Math.ceil(adjustments.length / adjustmentsPageSize));
  const salesTotalPages = Math.max(1, Math.ceil(sales.length / salesPageSize));

  const pagedAdjustments = useMemo(() => {
    const start = (adjustmentsPage - 1) * adjustmentsPageSize;
    return adjustments.slice(start, start + adjustmentsPageSize);
  }, [adjustments, adjustmentsPage, adjustmentsPageSize]);

  const pagedSales = useMemo(() => {
    const start = (salesPage - 1) * salesPageSize;
    return sales.slice(start, start + salesPageSize);
  }, [sales, salesPage, salesPageSize]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Detailed Reports</h1>
          <p className="text-gray-600">Track stock adjustments and sales activity per product.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isProductsPending ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={18} className="animate-spin" />
                Loading products...
              </div>
            ) : isProductsError ? (
              <p className="text-sm text-red-600">Unable to load products.</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-500">No products found.</p>
            ) : (
              <div className="space-y-2">
                {products.map((product) => {
                  const isActive = product.id === selectedProductId;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">SKU: {product.sku || '—'}</p>
                        </div>
                        <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-1">
                          {product.stockQuantity} units
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPage((prev) => Math.max(prev - 1, 1))}
                disabled={productPage === 1}
              >
                Previous
              </Button>
              <span className="text-xs text-gray-500">
                Page {productsData?.total ? productPage : 0} of {productTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPage((prev) => Math.min(prev + 1, productTotalPages))}
                disabled={productPage >= productTotalPages}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-gray-900">
                    {selectedProduct ? selectedProduct.name : 'Select a product'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedProduct
                      ? `SKU: ${selectedProduct.sku || '—'} · Current stock: ${selectedProduct.stockQuantity} units`
                      : 'Choose a product to view detailed activity.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStartDate(value);
                        if (endDate && value && value > endDate) {
                          setEndDate(value);
                        }
                      }}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <span className="text-xs text-gray-400">to</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500 hover:text-gray-900"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedProduct ? (
                <div className="text-sm text-gray-500">Select a product to view report data.</div>
              ) : isReportPending ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={18} className="animate-spin" />
                  Loading report data...
                </div>
              ) : isReportError ? (
                <div className="text-sm text-red-600">Unable to load detailed report.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Current Stock</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedProduct.stockQuantity} units</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                          <Package size={18} />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Total Adjustments</p>
                          <p className="text-lg font-semibold text-gray-900">{totalAdjustments}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                          <ClipboardList size={18} />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Net Units Sold</p>
                          <p className="text-lg font-semibold text-gray-900">{netUnitsSold.toFixed(2)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                          <ShoppingBag size={18} />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Net Sales Value</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(netSalesValue)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                          <TrendingUp size={18} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    Last activity: {lastActivityDate ? formatDateTime(lastActivityDate) : 'No activity logged yet.'}
                  </div>

                  {isEmptyReport && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                      No adjustments or sales activity recorded for this period.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-gray-900 font-semibold">Stock Adjustments</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustmentsPage((prev) => Math.max(prev - 1, 1))}
                      disabled={!selectedProduct || isReportPending || isReportError || adjustmentsPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-500">
                      Page {selectedProduct && !isReportPending && !isReportError ? adjustmentsPage : 0} of {selectedProduct ? adjustmentsTotalPages : 0}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustmentsPage((prev) => Math.min(prev + 1, adjustmentsTotalPages))}
                      disabled={!selectedProduct || isReportPending || isReportError || adjustmentsPage >= adjustmentsTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAdjustments}
                    disabled={!selectedProduct || isReportPending || isReportError || adjustments.length === 0}
                  >
                    <Download size={16} />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Date</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Type</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Change</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Before</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">After</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {!selectedProduct ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          Select a product to view adjustments.
                        </td>
                      </tr>
                    ) : isReportPending ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          Loading adjustments...
                        </td>
                      </tr>
                    ) : adjustments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          No adjustments recorded for this product.
                        </td>
                      </tr>
                    ) : (
                      pagedAdjustments.map((adjustment) => (
                        <tr key={adjustment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-gray-700 text-sm">{formatDateTime(adjustment.createdAt)}</td>
                          <td className="px-6 py-4 text-gray-900 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{adjustmentLabels[adjustment.type] ?? adjustment.type}</span>
                              {adjustment.type === 'CORRECT_ENTRY_ERROR' &&
                                adjustment.reason &&
                                adjustment.reason.trim().length > 0 && (
                                  <span
                                    title={adjustment.reason}
                                    className="inline-flex items-center text-gray-400 hover:text-gray-700"
                                  >
                                    <Info size={14} />
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                adjustment.quantityChange < 0
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {formatQuantity(adjustment.quantityChange)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-700 text-sm">{adjustment.quantityBefore}</td>
                          <td className="px-6 py-4 text-gray-700 text-sm">{adjustment.quantityAfter}</td>
                          <td className="px-6 py-4 text-gray-700 text-sm">
                            {adjustment.user?.fullName || adjustment.user?.username || 'System'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-gray-900 font-semibold">Sales Activity</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesPage((prev) => Math.max(prev - 1, 1))}
                      disabled={!selectedProduct || isReportPending || isReportError || salesPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-500">
                      Page {selectedProduct && !isReportPending && !isReportError ? salesPage : 0} of {selectedProduct ? salesTotalPages : 0}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesPage((prev) => Math.min(prev + 1, salesTotalPages))}
                      disabled={!selectedProduct || isReportPending || isReportError || salesPage >= salesTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportSales}
                    disabled={!selectedProduct || isReportPending || isReportError || sales.length === 0}
                  >
                    <Download size={16} />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Date</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Receipt</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Type</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Quantity</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Total</th>
                      <th className="px-6 py-3 text-left text-gray-700 text-sm">Attendant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {!selectedProduct ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          Select a product to view sales activity.
                        </td>
                      </tr>
                    ) : isReportPending ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          Loading sales activity...
                        </td>
                      </tr>
                    ) : sales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-sm text-gray-500 text-center">
                          No sales activity recorded for this product.
                        </td>
                      </tr>
                    ) : (
                      pagedSales.map((sale) => {
                        const isReversal = sale.receiptNumber.startsWith('REV-') || sale.quantity < 0;
                        return (
                          <tr key={sale.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-gray-700 text-sm">{formatDateTime(sale.createdAt)}</td>
                            <td className="px-6 py-4 text-gray-900 text-sm">{sale.receiptNumber}</td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  isReversal ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {isReversal ? 'Reversal' : 'Sale'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-700 text-sm">{formatQuantity(sale.quantity)}</td>
                            <td className="px-6 py-4 text-gray-700 text-sm">{formatCurrency(sale.total)}</td>
                            <td className="px-6 py-4 text-gray-700 text-sm">
                              {sale.attendant?.fullName || sale.attendant?.username || 'Walk-in'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
