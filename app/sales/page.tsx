'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, FileText, Loader2, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { describeChange, MetricChange } from '@/lib/metrics';

type ApiSale = {
  id: string;
  receiptNumber: string;
  userId: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  createdAt: string;
  status?: 'completed' | 'partial' | 'reversed';
  attendant: {
    fullName: string | null;
    username: string | null;
  } | null;
  items: {
    id: string;
    productId?: string;
    quantity: number;
    price: number;
    total: number;
    soldQuantity?: number;
    reversedQuantity?: number;
    remainingQuantity?: number;
    product?: {
      id: string;
      name: string;
      sku?: string | null;
    } | null;
  }[];
};

type ReverseLineState = {
  saleItemId: string;
  productId: string;
  quantity: string;
};

type SalesSummaryChanges = {
  totalRevenue: MetricChange;
  totalSales: MetricChange;
  averageOrderValue: MetricChange;
};

type SalesSummary = {
  totalRevenue: number;
  totalSales: number;
  averageOrderValue: number;
  revenueOverview: { day: string; revenue: number }[];
  changes: SalesSummaryChanges;
};

const currencyFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace('GHS', '₵').trim();
}

const TRANSACTIONS_PER_PAGE = 6;

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState('last7days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<ApiSale | null>(null);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reverseLines, setReverseLines] = useState<ReverseLineState[]>([]);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [isReversing, setIsReversing] = useState(false);
  const hasSelectedItems = reverseLines.some((line) => line.quantity.trim() !== '' && Number(line.quantity) > 0);
  const {
    data,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await fetch('/api/sales');
      if (!response.ok) {
        throw new Error('Failed to fetch sales data.');
      }
      return (await response.json()) as { sales: ApiSale[]; summary: SalesSummary };
    },
    retry: 1,
  });

  const summary = data?.summary;
  const sales = data?.sales ?? [];

  useEffect(() => {
    if (!isReverseModalOpen) {
      setReverseError(null);
      setIsReversing(false);
      setSelectedSale(null);
      setReverseLines([]);
    }
  }, [isReverseModalOpen]);

  const openReverseModal = (sale: ApiSale) => {
    setSelectedSale(sale);
    setReverseError(null);
    setReverseLines(
      (sale.items ?? []).map((item) => ({
        saleItemId: item.id,
        productId: String(item.productId ?? item.product?.id ?? ''),
        quantity: '',
      })),
    );
    setIsReverseModalOpen(true);
  };

  const getAuthUser = () => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem('authUser');
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as { id?: string };
    } catch {
      return null;
    }
  };

  const reverseSale = async (mode: 'full' | 'partial') => {
    if (!selectedSale) {
      return;
    }

    setIsReversing(true);
    setReverseError(null);

    try {
      const authUser = getAuthUser();
      const userId = authUser?.id;
      if (!userId) {
        throw new Error('Unable to determine current user. Please login again.');
      }

      const itemsPayload =
        mode === 'partial'
          ? reverseLines
              .map((line) => ({
                saleItemId: line.saleItemId,
                productId: line.productId,
                quantity: Number(line.quantity),
              }))
              .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0)
          : undefined;

      const response = await fetch(`/api/sales/${selectedSale.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paymentMethod: selectedSale.paymentMethod,
          items: itemsPayload,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reverse sale.');
      }

      await refetch();
      setIsReverseModalOpen(false);
    } catch (err) {
      console.error(err);
      setReverseError(err instanceof Error ? err.message : 'Unable to reverse sale.');
    } finally {
      setIsReversing(false);
    }
  };

  const transactions = useMemo(
    () =>
      sales.map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.receiptNumber,
        date: new Date(sale.createdAt).toISOString().slice(0, 10),
        customer: sale.attendant?.fullName ?? sale.attendant?.username ?? 'Walk-in',
        items: sale.items.reduce((sum, item) => sum + item.quantity, 0),
        paymentMethod: sale.paymentMethod.replace('_', ' ').toLowerCase(),
        total: sale.totalAmount,
        status: (sale.status ?? 'completed') as 'completed' | 'partial' | 'reversed',
        raw: sale,
      })),
    [sales],
  );

  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) {
      return transactions;
    }

    return transactions.filter((sale) => {
      if (startDate && sale.date < startDate) {
        return false;
      }
      if (endDate && sale.date > endDate) {
        return false;
      }
      return true;
    });
  }, [transactions, startDate, endDate]);

  const totalPages =
    filteredTransactions.length === 0
      ? 0
      : Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, transactions.length]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTransactions = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return [];
    }
    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    return filteredTransactions.slice(startIndex, startIndex + TRANSACTIONS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const paginationNumbers = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }
    const VISIBLE_PAGES = 5;
    if (totalPages <= VISIBLE_PAGES) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const halfWindow = Math.floor(VISIBLE_PAGES / 2);
    let start = currentPage - halfWindow;
    let end = currentPage + halfWindow;

    if (start < 1) {
      start = 1;
      end = VISIBLE_PAGES;
    }

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - VISIBLE_PAGES + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [totalPages, currentPage]);

  const showingFrom =
    filteredTransactions.length === 0 ? 0 : (currentPage - 1) * TRANSACTIONS_PER_PAGE + 1;
  const showingTo =
    filteredTransactions.length === 0
      ? 0
      : Math.min(currentPage * TRANSACTIONS_PER_PAGE, filteredTransactions.length);

  const overviewData = summary?.revenueOverview ?? [];
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalSales = summary?.totalSales ?? 0;
  const averageOrderValue = summary?.averageOrderValue ?? 0;
  const totalRevenueChange = describeChange(summary?.changes?.totalRevenue, {
    descriptor: 'vs last week',
    formatter: formatCurrency,
  });
  const totalSalesChange = describeChange(summary?.changes?.totalSales, {
    descriptor: 'vs last week',
    formatter: (value) => value.toLocaleString(),
  });
  const averageOrderValueChange = describeChange(summary?.changes?.averageOrderValue, {
    descriptor: 'vs last week',
    formatter: formatCurrency,
  });

  const handleExport = (type: 'csv' | 'pdf') => {
    alert(`Exporting to ${type.toUpperCase()}...`);
  };

  const renderMetricValue = (value: number, isCurrency = false) => {
    if (isPending) {
      return <span className="text-gray-500 text-sm">Loading…</span>;
    }
    if (isError) {
      return <span className="text-red-500 text-sm">--</span>;
    }
    return isCurrency ? formatCurrency(value) : value.toLocaleString();
  };

  const renderChart = () => {
    if (isPending) {
      return (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading revenue overview…
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex items-center justify-center h-[300px] text-red-500">
          Failed to load revenue overview.
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={overviewData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="day" stroke="#6B7280" />
          <YAxis stroke="#6B7280" />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="revenue" fill="#2563EB" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTransactions = () => {
    if (isPending) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading sales transactions…
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex items-center justify-center py-12 text-red-500">
          Failed to load sales transactions.
        </div>
      );
    }

    if (filteredTransactions.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">No sales found for this period.</div>
      );
    }

    const statusColor = (status: 'completed' | 'partial' | 'reversed') => {
      if (status === 'reversed') {
        return 'bg-red-100 text-red-700';
      }
      if (status === 'partial') {
        return 'bg-yellow-100 text-yellow-700';
      }
      return 'bg-green-100 text-green-700';
    };

    return (
      <tbody className="divide-y divide-gray-200">
        {paginatedTransactions.map((sale) => (
          <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-4 sm:px-6 py-4 text-gray-900">{sale.invoiceNumber}</td>
            <td className="px-4 sm:px-6 py-4 text-gray-700">{sale.date}</td>
            {/* <td className="px-6 py-4 text-gray-900">{sale.customer}</td> */}
            <td className="px-4 sm:px-6 py-4 text-gray-700">{sale.items}</td>
            <td className="px-4 sm:px-6 py-4 text-gray-700 capitalize">{sale.paymentMethod}</td>
            <td className="px-4 sm:px-6 py-4 text-gray-900">{formatCurrency(sale.total)}</td>
            <td className="px-4 sm:px-6 py-4">
              <span className={`px-3 py-1 rounded-full text-sm capitalize ${statusColor(sale.status)}`}>
                {sale.status}
              </span>
            </td>
            <td className="px-4 sm:px-6 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openReverseModal(sale.raw)}
                disabled={sale.status === 'reversed'}
              >
                Reverse
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-gray-900 mb-2">Sales Reports</h1>
          <p className="text-gray-600">Track and analyze your sales performance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button onClick={() => handleExport('csv')} variant="outline" className="w-full sm:w-auto justify-center">
            <FileText size={20} />
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf')} variant="outline" className="w-full sm:w-auto justify-center">
            <Download size={20} />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Revenue</p>
                <p className="text-gray-900 text-2xl font-semibold">{renderMetricValue(totalRevenue, true)}</p>
                <p
                  className={`text-sm mt-1 ${
                    totalRevenueChange.type === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {totalRevenueChange.text}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Sales</p>
                <p className="text-gray-900 text-2xl font-semibold">{renderMetricValue(totalSales)}</p>
                <p
                  className={`text-sm mt-1 ${
                    totalSalesChange.type === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {totalSalesChange.text}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                <FileText size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Avg. Order Value</p>
                <p className="text-gray-900 text-2xl font-semibold">{renderMetricValue(averageOrderValue, true)}</p>
                <p
                  className={`text-sm mt-1 ${
                    averageOrderValueChange.type === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {averageOrderValueChange.text}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-gray-900 font-bold text-lg">Sales Transactions</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <Calendar size={20} className="text-gray-400" />
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
                    className="w-[12.5rem] max-w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <span className="text-gray-500 text-sm font-medium">to</span>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-[12.5rem] max-w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Invoice #</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Date</th>
                  {/* <th className="px-6 py-3 text-left text-gray-700 text-sm">Customer</th> */}
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Items</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Payment</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Total</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              {renderTransactions()}
            </table>
          </div>
          {filteredTransactions.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{showingFrom}</span> to{' '}
                <span className="font-medium text-gray-900">{showingTo}</span> of{' '}
                <span className="font-medium text-gray-900">{filteredTransactions.length}</span> transactions
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                {paginationNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                      page === currentPage
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="mb-5">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-gray-900">Revenue Overview</h3>
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="last90days">Last 90 Days</option>
              <option value="thisyear">This Year</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-4">{renderChart()}</CardContent>
      </Card>

      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        title={selectedSale ? `Reverse Sale ${selectedSale.receiptNumber}` : 'Reverse Sale'}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsReverseModalOpen(false)} disabled={isReversing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => reverseSale('full')} disabled={isReversing || !selectedSale}>
              {isReversing ? 'Reversing…' : 'Reverse Entire Sale'}
            </Button>
            <Button variant="primary" onClick={() => reverseSale('partial')} disabled={isReversing || !selectedSale || !hasSelectedItems}>
              {isReversing ? 'Reversing…' : 'Reverse Selected Items'}
            </Button>
          </>
        }
      >
        {reverseError && <p className="text-red-600 text-sm mb-3">{reverseError}</p>}

        {selectedSale ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-600 text-xs mb-1">Subtotal</p>
                <p className="text-gray-900">{formatCurrency(selectedSale.subtotal)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-600 text-xs mb-1">Discount</p>
                <p className="text-gray-900">{formatCurrency(selectedSale.discount)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-600 text-xs mb-1">Total</p>
                <p className="text-gray-900">{formatCurrency(selectedSale.totalAmount)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-700 text-sm">Item</th>
                    <th className="px-3 py-2 text-left text-gray-700 text-sm">Sold</th>
                    <th className="px-3 py-2 text-left text-gray-700 text-sm">Reversed</th>
                    <th className="px-3 py-2 text-left text-gray-700 text-sm">Remaining</th>
                    <th className="px-3 py-2 text-left text-gray-700 text-sm">Qty to reverse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedSale.items.map((item) => {
                    const sold = item.soldQuantity ?? item.quantity;
                    const reversed = item.reversedQuantity ?? 0;
                    const remaining = item.remainingQuantity ?? item.quantity;
                    const line = reverseLines.find((l) => l.saleItemId === item.id);

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-900">
                          {item.product?.name ?? item.productId ?? 'Item'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{sold}</td>
                        <td className="px-3 py-2 text-gray-700">{reversed}</td>
                        <td className="px-3 py-2 text-gray-700">{remaining}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            step="0.01"
                            value={line?.quantity ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReverseLines((prev) =>
                                prev.map((entry) =>
                                  entry.saleItemId === item.id ? { ...entry, quantity: value } : entry,
                                ),
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-sm">Select a sale to reverse.</p>
        )}
      </Modal>
    </div>
  );
}
