'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Plus, Search, Edit, Trash2, Filter, MoreHorizontal, Package, AlertTriangle, Repeat, RefreshCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';

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

type StockAdjustmentType =
  | 'SUPPLIER_ADD'
  | 'DAMAGE_EXPIRED_REMOVE'
  | 'BULK_TO_SINGLES'
  | 'SINGLES_TO_BULK'
  | 'CORRECT_ENTRY_ERROR';

type StockActionOption = {
  type: StockAdjustmentType;
  title: string;
  description: string;
  helper: string;
  icon: LucideIcon;
  iconStyle: string;
  requiresReason?: boolean;
  isCorrection?: boolean;
};

const STOCK_ACTIONS: StockActionOption[] = [
  {
    type: 'CORRECT_ENTRY_ERROR',
    title: 'Correct Entry Error',
    description: 'Correct a previous stock entry mistake by adjusting the stock quantity.',
    helper: 'Use for fixing entry errors made on other stock actions.',
    icon: Wrench,
    iconStyle: 'bg-slate-100 text-slate-700',
    requiresReason: true,
    isCorrection: true,
  },
  {
    type: 'SUPPLIER_ADD',
    title: 'Add Stock from Supplier',
    description: 'Log new stock delivered by your supplier into the system.',
    helper: 'Use this when cartons or packs arrive in-store.',
    icon: Package,
    iconStyle: 'bg-green-100 text-green-700',
  },
  {
    type: 'DAMAGE_EXPIRED_REMOVE',
    title: 'Remove Stock (Damage/Expired)',
    description: 'Remove items that are damaged, expired, or no longer sellable.',
    helper: 'Keeps system stock aligned with what is actually on the shelf.',
    icon: AlertTriangle,
    iconStyle: 'bg-red-100 text-red-700',
  },
  {
    type: 'BULK_TO_SINGLES',
    title: 'Bulk -> Singles',
    description: 'Convert bulk packs into individual units for retail sales.',
    helper: 'Use when splitting a carton or pack into singles.',
    icon: Repeat,
    iconStyle: 'bg-amber-100 text-amber-700',
  },
  {
    type: 'SINGLES_TO_BULK',
    title: 'Singles -> Bulk',
    description: 'Group individual units back into bulk or sealed packs.',
    helper: 'Use when consolidating singles into packs.',
    icon: RefreshCcw,
    iconStyle: 'bg-blue-100 text-blue-700',
  },
];

export default function ProductsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<'full' | 'stock'>('full');
  const [activeStockAction, setActiveStockAction] = useState<StockActionOption | null>(null);
  const [stockCorrectionReason, setStockCorrectionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    costPrice: '',
    sellingPrice: '',
    stock: '',
  });
  const [stockInputMode, setStockInputMode] = useState<'absolute' | 'delta'>('delta');
  const [stockDelta, setStockDelta] = useState('');
  const skuInputRef = useRef<HTMLInputElement>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);
  const scannerBufferRef = useRef('');
  const scannerTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    if (editMode === 'stock') {
      stockInputRef.current?.focus({ preventScroll: true });
      return;
    }

    skuInputRef.current?.focus({ preventScroll: true });

    const resetScannerState = () => {
      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }
      scannerBufferRef.current = '';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Enter') {
        if (scannerBufferRef.current) {
          setFormData((prev) => ({ ...prev, sku: scannerBufferRef.current }));
          skuInputRef.current?.focus({ preventScroll: true });
        }
        resetScannerState();
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        scannerBufferRef.current += event.key;
        if (scannerTimeoutRef.current) {
          window.clearTimeout(scannerTimeoutRef.current);
        }
        scannerTimeoutRef.current = window.setTimeout(() => {
          resetScannerState();
        }, 100);
      } else {
        resetScannerState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      resetScannerState();
    };
  }, [editMode, isModalOpen, setFormData]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);

    return () => {
      window.clearTimeout(handler);
    };
  }, [searchTerm]);
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    isError,
  } = useQuery<ProductsResponse, Error>({
    queryKey: ['products', currentPage, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', '25');
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      return (await response.json()) as ProductsResponse;
    },
    retry: 1,
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const pageSize = data?.pageSize ?? 25;

  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  const handleOpenModal = ({
    product,
    mode = 'full',
    action = null,
  }: {
    product?: Product | null;
    mode?: 'full' | 'stock';
    action?: StockActionOption | null;
  } = {}) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        stock: product.stockQuantity.toString(),
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        costPrice: '',
        sellingPrice: '',
        stock: '',
      });
    }
    setEditMode(mode);
    setActiveStockAction(action);
    setStockInputMode('delta');
    setStockDelta('');
    setStockCorrectionReason('');
    setIsModalOpen(true);
  };

  const handleOpenActionModal = (product: Product) => {
    setEditingProduct(product);
    setIsActionModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setEditMode('full');
    setActiveStockAction(null);
    setStockInputMode('delta');
    setStockDelta('');
    setStockCorrectionReason('');
  };

  const handleCloseActionModal = () => {
    setIsActionModalOpen(false);
    setActiveStockAction(null);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const isCreate = !editingProduct;
    const isStockMode = editMode === 'stock';
    const payload: Record<string, string | number> = {};

    if (isCreate || editMode === 'full') {
      payload.name = formData.name;
      payload.sku = formData.sku;
      payload.costPrice = formData.costPrice;
      payload.sellingPrice = formData.sellingPrice;
    }

    if (isCreate || isStockMode) {
      if (isStockMode && stockInputMode === 'delta') {
        payload.stock = computedStockQuantity;
      } else {
        payload.stock = formData.stock;
      }
    }

    if (isStockMode && activeStockAction) {
      const requiresReason = Boolean(activeStockAction.requiresReason);
      if (requiresReason && stockCorrectionReason.trim().length === 0) {
        setActionError('Reason is required before saving this correction.');
        setIsSubmitting(false);
        return;
      }

      if (activeStockAction.isCorrection) {
        payload.stockAdjustmentType = 'CORRECT_ENTRY_ERROR';
        payload.reason = stockCorrectionReason.trim();
      } else {
        payload.stockAdjustmentType = activeStockAction.type;
      }
    }

    const authUser = getAuthUser();
    if (authUser?.id) {
      payload.userId = authUser.id;
    }

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });

      handleCloseModal();
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete product');
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Unable to delete product.');
    }
  };

  const isStockMode = editMode === 'stock';
  const isCreateMode = !editingProduct;
  const currentStock = editingProduct?.stockQuantity ?? 0;
  const stockInputValue = stockInputMode === 'delta' ? stockDelta : formData.stock;
  const parsedDelta = Number(stockDelta);
  const hasDeltaValue = stockDelta.trim() !== '';
  const isDeltaNumeric = !Number.isNaN(parsedDelta);
  const computedStockQuantity = isDeltaNumeric ? Number((currentStock + parsedDelta).toFixed(2)) : Number.NaN;
  const isDeltaInvalid = stockInputMode === 'delta' && (!hasDeltaValue || !isDeltaNumeric);
  const isComputedNegative = stockInputMode === 'delta' && isDeltaNumeric && computedStockQuantity < 0;
  const isAbsoluteInvalid = stockInputMode === 'absolute' && formData.stock.trim() === '';
  const isStockInputInvalid = isStockMode && (stockInputMode === 'delta' ? isDeltaInvalid || isComputedNegative : isAbsoluteInvalid);
  const isCorrectionReasonInvalid = Boolean(isStockMode && activeStockAction?.requiresReason && stockCorrectionReason.trim().length === 0);
  const modalTitle = isStockMode
    ? `${activeStockAction?.title ?? 'Adjust Stock'}${editingProduct ? ` - ${editingProduct.name}` : ''}`
    : editingProduct
      ? 'Edit Product'
      : 'Add New Product';
  const submitLabel = isStockMode ? 'Save Adjustment' : editingProduct ? 'Update Product' : 'Add Product';
  const isSubmitDisabled = isSubmitting || (isStockMode && (!activeStockAction || isStockInputInvalid || isCorrectionReasonInvalid));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-gray-900 mb-2">Products Management</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary">
          <Plus size={20} />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button variant="outline">
              <Filter size={20} />
              Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {(actionError || isError) && (
              <p className="px-6 py-3 text-red-600 text-sm">
                {actionError ?? 'Unable to load products. Please try again.'}
              </p>
            )}
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Product Name</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">SKU</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Cost Price</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Selling Price</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Stock</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isPending ? (
                  <tr>
                    <td className="px-6 py-4 text-gray-500" colSpan={6}>
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-gray-500" colSpan={6}>
                      {isError ? 'Failed to load products.' : 'No products found.'}
                    </td>
                  </tr>
                ) : (
                  products.map((product: Product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-gray-700">{product.sku}</td>
                      <td className="px-6 py-4 text-gray-700">₵{product.costPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-900">₵{product.sellingPrice.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${
                            product.stockQuantity < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {product.stockQuantity} units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal({ product })}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit product details"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(product)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Stock actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete product"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-gray-600 text-sm">
              {total === 0
                ? 'No products to display'
                : `Showing ${startItem} to ${endItem} of ${total} products`}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} variant="outline" size="sm">
                Previous
              </Button>
              <Button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || total === 0}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
              <span className="text-sm text-gray-600">
                Page {total === 0 ? 0 : currentPage} of {totalPages}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isActionModalOpen}
        onClose={handleCloseActionModal}
        title={editingProduct ? `Stock Actions - ${editingProduct.name}` : 'Stock Actions'}
      >
        {editingProduct ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Choose the type of stock adjustment to record.</p>
              <p className="text-sm font-semibold text-gray-900 mt-2">
                Current stock: {editingProduct.stockQuantity} units
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {STOCK_ACTIONS.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={`${action.type}-${action.title}`}
                    type="button"
                    onClick={() => {
                      handleOpenModal({ product: editingProduct, mode: 'stock', action });
                      setIsActionModalOpen(false);
                    }}
                    className="rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${action.iconStyle}`}>
                        <ActionIcon size={20} />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold">{action.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                        <p className="text-xs text-gray-500 mt-2">{action.helper}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Select a product to manage stock adjustments.</p>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        footer={
          <>
            <Button onClick={handleCloseModal} variant="outline">
              Cancel
            </Button>
            <Button form="product-form" type="submit" variant="primary" disabled={isSubmitDisabled}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          {isStockMode ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${activeStockAction?.iconStyle ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {(() => {
                      const ActiveIcon = activeStockAction?.icon;
                      return ActiveIcon ? <ActiveIcon size={20} /> : <Package size={20} />;
                    })()}
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold">{activeStockAction?.title ?? 'Stock Adjustment'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {activeStockAction?.description ?? 'Update the stock quantity for this product.'}
                    </p>
                    {activeStockAction?.helper && <p className="text-xs text-gray-500 mt-2">{activeStockAction.helper}</p>}
                    {editingProduct && (
                      <p className="text-xs text-gray-500 mt-2">Current stock: {editingProduct.stockQuantity} units</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Adjustment entry</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={stockInputMode === 'delta' ? 'primary' : 'outline'}
                    onClick={() => setStockInputMode('delta')}
                  >
                    Adjust by +/-
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={stockInputMode === 'absolute' ? 'primary' : 'outline'}
                    onClick={() => setStockInputMode('absolute')}
                  >
                    Set new quantity
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {stockInputMode === 'delta'
                    ? 'Use a positive number to add stock, negative to remove.'
                    : 'Set the final stock quantity after the adjustment.'}
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  label={stockInputMode === 'delta' ? 'Adjust by (+/- units)' : 'New Stock Quantity'}
                  type="number"
                  value={stockInputValue}
                  onChange={(event) => {
                    if (stockInputMode === 'delta') {
                      setStockDelta(event.target.value);
                    } else {
                      setFormData((prev) => ({ ...prev, stock: event.target.value }));
                    }
                  }}
                  placeholder={
                    stockInputMode === 'delta'
                      ? 'e.g. 10 or -5'
                      : editingProduct
                        ? String(editingProduct.stockQuantity)
                        : '0'
                  }
                  ref={stockInputRef}
                  required
                />
                {stockInputMode === 'delta' && (
                  <p className={`text-xs ${isDeltaInvalid || isComputedNegative ? 'text-red-600' : 'text-gray-500'}`}>
                    Resulting stock:{' '}
                    {isDeltaInvalid ? '—' : `${computedStockQuantity} units`}
                    {isComputedNegative ? ' (cannot be negative)' : ''}
                  </p>
                )}
              </div>

              {activeStockAction?.requiresReason && (
                <Input
                  label="Reason"
                  type="text"
                  value={stockCorrectionReason}
                  onChange={(event) => setStockCorrectionReason(event.target.value)}
                  placeholder="Enter a reason for this correction"
                  required
                />
              )}
            </div>
          ) : (
            <>
              <Input
                label="Product Name"
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value.toUpperCase() })}
                placeholder="e.g., POWERZONE BIG"
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SKU"
                  type="text"
                  value={formData.sku}
                  onChange={(event) => setFormData({ ...formData, sku: event.target.value })}
                  placeholder="e.g., PZB-001"
                  ref={skuInputRef}
                  required
                />
                {isCreateMode ? (
                  <Input
                    label="Stock Quantity"
                    type="number"
                    value={formData.stock}
                    onChange={(event) => setFormData({ ...formData, stock: event.target.value })}
                    placeholder="0"
                    ref={stockInputRef}
                    required
                  />
                ) : (
                  <div>
                    <label className="block text-gray-700 mb-2">Stock Quantity</label>
                    <div className="h-9 flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-gray-600 text-sm">
                      {editingProduct?.stockQuantity ?? 0} units
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Use the Actions menu to adjust stock.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Cost Price"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                  placeholder="0.00"
                  required
                />
                <Input
                  label="Selling Price"
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
