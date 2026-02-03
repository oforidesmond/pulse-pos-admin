import { NextResponse } from 'next/server';
import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const paymentMethodSet = new Set(Object.values(PaymentMethod));

const saleInclude = {
  attendant: true,
  items: {
    include: {
      product: true,
    },
  },
} as const satisfies Prisma.SaleInclude;

type SaleWithRelations = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;
type FormattedSale = ReturnType<typeof formatSale>;

type ProductWithStock = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: {
    quantity: Prisma.Decimal;
  } | null;
};

function formatSale(sale: SaleWithRelations) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    userId: sale.userId,
    paymentMethod: sale.paymentMethod,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount ?? 0),
    totalAmount: Number(sale.totalAmount),
    createdAt: sale.createdAt,
    attendant: sale.attendant
      ? {
          id: sale.attendant.id,
          fullName: sale.attendant.fullName,
          username: sale.attendant.username,
        }
      : null,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: Number(item.quantity),
      price: Number(item.price),
      total: Number(item.total),
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
          }
        : null,
    })),
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfPreviousWeek() {
  const date = sevenDaysAgo();
  date.setDate(date.getDate() - 7);
  return date;
}

function buildChangeSummary(current: number, previous: number) {
  const delta = current - previous;
  let percentage: number | null;

  if (previous === 0) {
    percentage = current === 0 ? 0 : null;
  } else {
    percentage = Number(((delta / Math.abs(previous)) * 100).toFixed(1));
  }

  return { delta, percentage };
}

function buildRevenueOverview(sales: FormattedSale[]) {
  const today = new Date();
  const lastSevenDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  });

  const revenueByDate = sales.reduce((map, sale) => {
    const saleDateKey = new Date(sale.createdAt).toISOString().slice(0, 10);
    const currentTotal = map.get(saleDateKey) ?? 0;
    map.set(saleDateKey, currentTotal + sale.totalAmount);
    return map;
  }, new Map<string, number>());

  return lastSevenDays.map(({ key, label }) => ({
    day: label,
    revenue: Number((revenueByDate.get(key) ?? 0).toFixed(2)),
  }));
}

function buildSalesSummary(sales: FormattedSale[]) {
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalSales = sales.length;
  const averageOrderValue = totalSales ? totalRevenue / totalSales : 0;

  return {
    totalRevenue,
    totalSales,
    averageOrderValue,
    revenueOverview: buildRevenueOverview(sales),
  };
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function centsToAmount(cents: number) {
  return cents / 100;
}

function isReversalReceipt(receiptNumber: string) {
  return receiptNumber.startsWith('REV-');
}

function parseReversedSaleId(receiptNumber: string) {
  if (!isReversalReceipt(receiptNumber)) {
    return null;
  }

  const rest = receiptNumber.slice(4);
  const [saleId] = rest.split('-');
  return saleId || null;
}

function itemKey(productId: string, price: number) {
  return `${productId}:${toCents(price)}`;
}

export async function GET() {
  try {
    const startCurrentWeek = sevenDaysAgo();
    const startPrevWeek = startOfPreviousWeek();

    const sales = (await prisma.sale.findMany({
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
    })) as SaleWithRelations[];

    const [currentWeekRevenueAggregate, previousWeekRevenueAggregate, currentWeekSalesCount, previousWeekSalesCount] =
      await Promise.all([
        prisma.sale.aggregate({
          where: { createdAt: { gte: startCurrentWeek } },
          _sum: { totalAmount: true },
        }),
        prisma.sale.aggregate({
          where: { createdAt: { gte: startPrevWeek, lt: startCurrentWeek } },
          _sum: { totalAmount: true },
        }),
        prisma.sale.count({
          where: {
            createdAt: { gte: startCurrentWeek },
            NOT: { receiptNumber: { startsWith: 'REV-' } },
          },
        }),
        prisma.sale.count({
          where: {
            createdAt: { gte: startPrevWeek, lt: startCurrentWeek },
            NOT: { receiptNumber: { startsWith: 'REV-' } },
          },
        }),
      ]);

    const reversalsBySaleId = new Map<
      string,
      {
        subtotal: number;
        discount: number;
        totalAmount: number;
        quantityByKey: Map<string, number>;
      }
    >();

    for (const sale of sales) {
      if (!isReversalReceipt(sale.receiptNumber)) {
        continue;
      }

      const reversedSaleId = parseReversedSaleId(sale.receiptNumber);
      if (!reversedSaleId) {
        continue;
      }

      const entry = reversalsBySaleId.get(reversedSaleId) ?? {
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
        quantityByKey: new Map<string, number>(),
      };

      entry.subtotal += Number(sale.subtotal);
      entry.discount += Number(sale.discount ?? 0);
      entry.totalAmount += Number(sale.totalAmount);

      for (const item of sale.items) {
        const key = itemKey(item.productId, Number(item.price));
        entry.quantityByKey.set(key, (entry.quantityByKey.get(key) ?? 0) + Number(item.quantity));
      }

      reversalsBySaleId.set(reversedSaleId, entry);
    }

    const baseSales = sales.filter((sale) => !isReversalReceipt(sale.receiptNumber));

    const formattedSales = baseSales.map((sale) => {
      const formatted = formatSale(sale);
      const reversal = reversalsBySaleId.get(sale.id);

      const normalized = {
        ...formatted,
        status: 'completed' as 'completed' | 'partial' | 'reversed',
        items: formatted.items.map((item) => ({
          ...item,
          soldQuantity: item.quantity,
          reversedQuantity: 0,
          remainingQuantity: item.quantity,
        })),
      };

      if (!reversal) {
        return normalized;
      }

      const netSubtotal = normalized.subtotal + reversal.subtotal;
      const netDiscount = normalized.discount + reversal.discount;
      const netTotalAmount = normalized.totalAmount + reversal.totalAmount;

      const netItems = normalized.items.map((item) => {
        const key = itemKey(item.productId, item.price);
        const reversedQuantityRaw = -(reversal.quantityByKey.get(key) ?? 0);
        const remainingQuantity = item.soldQuantity - reversedQuantityRaw;
        const priceCents = toCents(item.price);
        const netLineTotalCents = Math.round(priceCents * remainingQuantity);

        return {
          ...item,
          quantity: remainingQuantity,
          total: centsToAmount(netLineTotalCents),
          reversedQuantity: reversedQuantityRaw,
          remainingQuantity,
        };
      });

      const remainingUnits = netItems.reduce((sum, item) => sum + Number(item.remainingQuantity ?? 0), 0);
      const anyReversed = netItems.some((item) => Number(item.reversedQuantity ?? 0) > 0);
      const status = remainingUnits <= 0 ? 'reversed' : anyReversed ? 'partial' : 'completed';

      return {
        ...normalized,
        subtotal: Number(netSubtotal.toFixed(2)),
        discount: Number(netDiscount.toFixed(2)),
        totalAmount: Number(netTotalAmount.toFixed(2)),
        status,
        items: netItems,
      };
    });

    const summary = buildSalesSummary(formattedSales);
    const currentWeekRevenue = Number(currentWeekRevenueAggregate._sum.totalAmount ?? 0);
    const previousWeekRevenue = Number(previousWeekRevenueAggregate._sum.totalAmount ?? 0);
    const currentWeekAov = currentWeekSalesCount ? currentWeekRevenue / currentWeekSalesCount : 0;
    const previousWeekAov = previousWeekSalesCount ? previousWeekRevenue / previousWeekSalesCount : 0;

    const summaryWithChanges = {
      ...summary,
      changes: {
        totalRevenue: buildChangeSummary(currentWeekRevenue, previousWeekRevenue),
        totalSales: buildChangeSummary(currentWeekSalesCount, previousWeekSalesCount),
        averageOrderValue: buildChangeSummary(currentWeekAov, previousWeekAov),
      },
    };

    return NextResponse.json({ sales: formattedSales, summary: summaryWithChanges });
  } catch (error) {
    console.error('Failed to fetch sales', error);
    return NextResponse.json({ error: 'Unable to fetch sales.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { receiptNumber, userId, paymentMethod, items, discount = 0 } = body ?? {};

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const normalizedPaymentMethod = String(paymentMethod).toUpperCase() as PaymentMethod;
    if (!paymentMethod || !paymentMethodSet.has(normalizedPaymentMethod)) {
      return NextResponse.json({ error: 'paymentMethod is invalid.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one sale item is required.' }, { status: 400 });
    }

    const parsedDiscount = Number(discount ?? 0);
    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0) {
      return NextResponse.json({ error: 'discount must be a positive number.' }, { status: 400 });
    }

    const sanitizedItems: { productId: string; quantity: number; priceOverride?: number }[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item || typeof item !== 'object') {
        return NextResponse.json({ error: `Item at position ${index + 1} is invalid.` }, { status: 400 });
      }

      if (!item.productId) {
        return NextResponse.json({ error: `Item ${index + 1} is missing productId.` }, { status: 400 });
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: `Item ${index + 1} quantity must be a positive number.` }, { status: 400 });
      }

      let priceOverride: number | undefined;
      if (item.price !== undefined) {
        priceOverride = Number(item.price);
        if (!Number.isFinite(priceOverride) || priceOverride < 0) {
          return NextResponse.json({ error: `Item ${index + 1} price must be a positive number.` }, { status: 400 });
        }
      }

      sanitizedItems.push({ productId: item.productId, quantity, priceOverride });
    }

    const productIds = Array.from(new Set(sanitizedItems.map((item) => item.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        stock: {
          select: {
            quantity: true,
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      const missing = productIds.filter((id) => !products.find((product: ProductWithStock) => product.id === id));
      return NextResponse.json({ error: `Products not found: ${missing.join(', ')}` }, { status: 404 });
    }

    const productMap = new Map<string, ProductWithStock>(
      products.map((product: ProductWithStock) => [product.id, product]),
    );

    let subtotalInCents = 0;
    const itemsPayload = sanitizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error('Product missing during sale creation.');
      }

      if (!product.stock) {
        throw new Error(`Product "${product.name}" has no stock record.`);
      }

      const available = Number(product.stock.quantity);
      if (item.quantity > available) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${available}`);
      }

      const defaultPrice = Number(product.price);
      const unitPrice = item.priceOverride ?? defaultPrice;

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`Invalid price for ${product.name}.`);
      }

      const priceInCents = toCents(unitPrice);
      const lineTotalInCents = Math.round(priceInCents * item.quantity);
      subtotalInCents += lineTotalInCents;

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: centsToAmount(priceInCents),
        total: centsToAmount(lineTotalInCents),
      };
    });

    const discountInCents = toCents(parsedDiscount);
    if (discountInCents > subtotalInCents) {
      return NextResponse.json({ error: 'Discount cannot exceed subtotal.' }, { status: 400 });
    }

    const sale = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const decrementByProductId = new Map<string, number>();
        for (const item of itemsPayload) {
          decrementByProductId.set(
            item.productId,
            (decrementByProductId.get(item.productId) ?? 0) + item.quantity,
          );
        }

        const stockBeforeByProductId = new Map<string, number>();
        for (const [productId, quantity] of decrementByProductId.entries()) {
          const stock = await tx.stock.findUnique({ where: { productId } });
          if (!stock || Number(stock.quantity) < quantity) {
            throw new Error('Stock levels changed. Please refresh and try again.');
          }
          stockBeforeByProductId.set(productId, Number(stock.quantity));
        }

        const createdSale = await tx.sale.create({
          data: {
            receiptNumber:
              receiptNumber && typeof receiptNumber === 'string' && receiptNumber.trim().length > 0
                ? receiptNumber.trim()
                : `SAL-${Date.now()}`,
            userId,
            subtotal: centsToAmount(subtotalInCents),
            discount: centsToAmount(discountInCents),
            totalAmount: centsToAmount(subtotalInCents - discountInCents),
            paymentMethod: normalizedPaymentMethod,
            items: {
              create: itemsPayload,
            },
          },
          include: saleInclude,
        });

        await Promise.all(
          Array.from(decrementByProductId.entries()).map(async ([productId, quantity]) => {
            const quantityBefore = stockBeforeByProductId.get(productId) ?? 0;
            const quantityChange = Number((-quantity).toFixed(2));
            const quantityAfter = Number((quantityBefore + quantityChange).toFixed(2));

            await tx.stock.update({
              where: { productId },
              data: { quantity: { decrement: quantity } },
            });

            await (tx as any).stockAdjustment.create({
              data: {
                productId,
                type: 'SALE',
                quantityBefore,
                quantityAfter,
                quantityChange,
                userId: String(userId),
              },
            });
          }),
        );

        return createdSale;
      },
      {
        timeout: 60000, // 60 seconds timeout
      }
    );

    return NextResponse.json({ sale: formatSale(sale) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create sale', error);

    if (error instanceof Error && error.message) {
      const message = error.message.includes('Insufficient stock') || error.message.includes('no stock record')
        ? error.message
        : undefined;

      if (message) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const metaMessage = error?.code === 'P2002' && error?.meta?.target?.includes('receiptNumber')
      ? 'Receipt number must be unique.'
      : 'Unable to create sale.';

    return NextResponse.json({ error: metaMessage }, { status: 500 });
  }
}
