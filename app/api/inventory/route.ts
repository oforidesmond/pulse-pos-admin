'use server';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const LOW_STOCK_THRESHOLD = 10;
const REORDER_LEVEL_DEFAULT = 20;

type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
type ProductWithStock = Awaited<ReturnType<typeof prisma.product.findMany>>[number];
type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  status: InventoryStatus;
  lastRestocked: string;
};

function determineStatus(quantity: number): InventoryStatus {
  if (quantity <= 0) {
    return 'out-of-stock';
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return 'low-stock';
  }
  return 'in-stock';
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stock: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: InventoryItem[] = products.map((product: ProductWithStock) => {
      const rawQuantity = product.stock?.quantity ?? 0;
      const quantity =
        typeof rawQuantity === 'number'
          ? rawQuantity
          : typeof rawQuantity === 'string'
            ? Number(rawQuantity)
            : typeof (rawQuantity as { toNumber?: () => number }).toNumber === 'function'
              ? (rawQuantity as { toNumber: () => number }).toNumber()
              : Number(rawQuantity);
      const status = determineStatus(quantity);
      const reorderLevel = Math.max(REORDER_LEVEL_DEFAULT, Math.round(quantity * 0.5));

      return {
        id: product.id,
        name: product.name,
        sku: product.sku ?? '',
        quantity: Number.isFinite(quantity) ? quantity : 0,
        reorderLevel,
        status,
        lastRestocked: product.stock?.lastUpdatedAt?.toISOString() ?? product.updatedAt.toISOString(),
      };
    });

    const totalUnits = items.reduce((sum: number, item: InventoryItem) => sum + item.quantity, 0);
    const productCount = items.length;
    const lowStockCount = items.filter((item: InventoryItem) => item.status === 'low-stock').length;
    const outOfStockCount = items.filter((item: InventoryItem) => item.status === 'out-of-stock').length;

    return NextResponse.json({
      metrics: {
        totalUnits,
        productCount,
        lowStockCount,
        outOfStockCount,
      },
      items,
    });
  } catch (error) {
    console.error('Failed to load inventory data', error);
    return NextResponse.json({ error: 'Unable to load inventory data.' }, { status: 500 });
  }
}
