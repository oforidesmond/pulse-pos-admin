import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type AdjustmentWithUser = Prisma.StockAdjustmentGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        fullName: true;
        username: true;
      };
    };
  };
}>;

type SaleItemWithSale = Prisma.SaleItemGetPayload<{
  include: {
    sale: {
      select: {
        id: true;
        receiptNumber: true;
        paymentMethod: true;
        userId: true;
        createdAt: true;
        attendant: {
          select: {
            id: true;
            fullName: true;
            username: true;
          };
        };
      };
    };
  };
}>;

const saleItemInclude = {
  sale: {
    select: {
      id: true,
      receiptNumber: true,
      paymentMethod: true,
      userId: true,
      createdAt: true,
      attendant: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
    },
  },
} as const satisfies Prisma.SaleItemInclude;

const adjustmentInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
    },
  },
} as const satisfies Prisma.StockAdjustmentInclude;

function formatProduct(product: any) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? '',
    costPrice: Number(product.cost ?? 0),
    sellingPrice: Number(product.price ?? 0),
    stockQuantity: Number(product.stock?.quantity ?? 0),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function parseDate(value: string | null, isEnd = false) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const startDate = parseDate(searchParams.get('startDate'));
    const endDate = parseDate(searchParams.get('endDate'), true);

    if (!productId) {
      return NextResponse.json({ error: 'productId is required.' }, { status: 400 });
    }

    if (searchParams.get('startDate') && !startDate) {
      return NextResponse.json({ error: 'startDate is invalid.' }, { status: 400 });
    }

    if (searchParams.get('endDate') && !endDate) {
      return NextResponse.json({ error: 'endDate is invalid.' }, { status: 400 });
    }

    const rawLimit = Number(searchParams.get('limit') ?? '150');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 150;

    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      createdAtFilter.gte = startDate;
    }
    if (endDate) {
      createdAtFilter.lte = endDate;
    }

    const dateFilter = Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : undefined;

    const [product, adjustments, salesItems] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        include: { stock: true },
      }),
      prisma.stockAdjustment.findMany({
        where: {
          productId,
          ...(dateFilter ?? {}),
        },
        include: adjustmentInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }) as Promise<AdjustmentWithUser[]>,
      prisma.saleItem.findMany({
        where: {
          productId,
          ...(dateFilter ? { sale: dateFilter } : {}),
        },
        include: saleItemInclude,
        orderBy: {
          sale: {
            createdAt: 'desc',
          },
        },
        take: limit,
      }) as Promise<SaleItemWithSale[]>,
    ]);

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const formattedAdjustments = adjustments.map((adjustment: AdjustmentWithUser) => ({
      id: adjustment.id,
      type: adjustment.type,
      quantityBefore: Number(adjustment.quantityBefore),
      quantityAfter: Number(adjustment.quantityAfter),
      quantityChange: Number(adjustment.quantityChange),
      reason: (adjustment as any).reason ?? null,
      createdAt: adjustment.createdAt,
      user: adjustment.user
        ? {
            id: adjustment.user.id,
            fullName: adjustment.user.fullName,
            username: adjustment.user.username,
          }
        : null,
    }));

    const formattedSales = salesItems.map((item: SaleItemWithSale) => ({
      id: item.id,
      saleId: item.saleId,
      receiptNumber: item.sale?.receiptNumber ?? 'N/A',
      paymentMethod: item.sale?.paymentMethod ?? null,
      quantity: Number(item.quantity),
      price: Number(item.price),
      total: Number(item.total),
      createdAt: item.sale?.createdAt ?? null,
      userId: item.sale?.userId ?? null,
      attendant: item.sale?.attendant
        ? {
            id: item.sale.attendant.id,
            fullName: item.sale.attendant.fullName,
            username: item.sale.attendant.username,
          }
        : null,
    }));

    return NextResponse.json({
      product: formatProduct(product),
      adjustments: formattedAdjustments,
      sales: formattedSales,
    });
  } catch (error) {
    console.error('Failed to fetch detailed report', error);
    return NextResponse.json({ error: 'Unable to fetch detailed report.' }, { status: 500 });
  }
}
