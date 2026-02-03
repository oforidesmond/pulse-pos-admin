'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, AlertTriangle, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  status: InventoryStatus;
  lastRestocked: string;
};

type InventoryMetrics = {
  totalUnits: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
};

type InventoryResponse = {
  metrics: InventoryMetrics;
  items: InventoryItem[];
};

function getStatusColor(status: InventoryStatus) {
  switch (status) {
    case 'in-stock':
      return 'bg-green-100 text-green-700';
    case 'low-stock':
      return 'bg-yellow-100 text-yellow-700';
    case 'out-of-stock':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStockPercentage(stock: number, reorderLevel: number) {
  const denominator = reorderLevel * 2 || 1;
  const percentage = (stock / denominator) * 100;
  return Math.min(percentage, 100);
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | InventoryItem['status']>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const {
    data,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await fetch('/api/inventory');
      if (!response.ok) {
        throw new Error('Failed to fetch inventory data.');
      }
      return (await response.json()) as InventoryResponse;
    },
    retry: 1,
  });

  const inventory = data?.items ?? [];
  const metrics = data?.metrics;

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [inventory, searchTerm, filterStatus]);

  // Pagination logic
  const totalItems = filteredInventory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInventory.slice(indexOfFirstItem, indexOfLastItem);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  // Format number with thousand separators and max 2 decimal places
  const formatNumber = (num: number): string =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(num);

  const totalUnits = metrics?.totalUnits ?? 0;
  const productCount = metrics?.productCount ?? 0;
  const lowStockCount = metrics?.lowStockCount ?? 0;
  const outOfStockCount = metrics?.outOfStockCount ?? 0;

  const renderMetricValue = (value: string | number) => {
    if (isPending) {
      return <span className="text-gray-500 text-sm">Loading…</span>;
    }
    if (isError) {
      return <span className="text-red-500 text-sm">--</span>;
    }
    return value;
  };

  const renderTableBody = () => {
    if (isPending) {
      return (
        <tbody>
          <tr>
            <td colSpan={7} className="py-12">
              <div className="flex items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} />
                Loading inventory…
              </div>
            </td>
          </tr>
        </tbody>
      );
    }

    if (isError) {
      return (
        <tbody>
          <tr>
            <td colSpan={7} className="py-12">
              <div className="text-center text-red-500">Failed to load inventory data.</div>
            </td>
          </tr>
        </tbody>
      );
    }

    if (filteredInventory.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={7} className="py-12">
              <div className="text-center text-gray-500">No products match your filters.</div>
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody className="divide-y divide-gray-200">
        {currentItems.map((item) => {
          const stockPercentage = getStockPercentage(item.quantity, item.reorderLevel);
          return (
            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-gray-900">{item.name}</td>
              <td className="px-6 py-4 text-gray-700">{item.sku || '—'}</td>
              <td className="px-6 py-4 text-gray-900">{item.quantity} units</td>
              <td className="px-6 py-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.status === 'in-stock'
                        ? 'bg-green-500'
                        : item.status === 'low-stock'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${stockPercentage}%` }}
                  />
                </div>
              </td>
              <td className="px-6 py-4 text-gray-700">{item.reorderLevel} units</td>
              <td className="px-6 py-4 text-gray-700">
                {new Date(item.lastRestocked).toLocaleDateString('en-GB')}
              </td>
              <td className="px-6 py-4">
                <span className={`px-3 py-1 rounded-full text-sm capitalize ${getStatusColor(item.status)}`}>
                  {item.status.replace('-', ' ')}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-2">Inventory Management</h1>
        <p className="text-gray-600">Monitor and manage your stock levels</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Items in Stock</p>
                <p className="text-gray-900 text-lg font-semibold">
                  {renderMetricValue(`${formatNumber(totalUnits)} units`)}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {renderMetricValue(`${productCount} product${productCount === 1 ? '' : 's'}`)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                <Package size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Low Stock Items</p>
                <p className="text-gray-900 text-lg font-semibold">
                  {renderMetricValue(`${lowStockCount} product${lowStockCount === 1 ? '' : 's'}`)}
                </p>
                <p className="text-yellow-600 text-sm mt-1">Needs attention</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Out of Stock</p>
                <p className="text-gray-900 text-lg font-semibold">
                  {renderMetricValue(`${outOfStockCount} product${outOfStockCount === 1 ? '' : 's'}`)}
                </p>
                <p className="text-red-600 text-sm mt-1">Restock immediately</p>
              </div>
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockCount > 0 && data && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-yellow-900">Low Stock Alert</p>
            <p className="text-yellow-700 text-sm mt-1">
              You have {lowStockCount} product{lowStockCount > 1 ? 's' : ''} running low on stock. Consider restocking soon.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
              <Button variant="outline">
                <Filter size={20} />
                More Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Product Name</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">SKU</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Current Stock</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Stock Level</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Reorder Level</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Last Restocked</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Status</th>
                </tr>
              </thead>
              {renderTableBody()}
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalItems)}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, totalItems)}
                  </span>{' '}
                  of <span className="font-medium">{totalItems}</span> results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => paginate(pageNum)}
                        className={`w-10 h-10 rounded-md flex items-center justify-center ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
