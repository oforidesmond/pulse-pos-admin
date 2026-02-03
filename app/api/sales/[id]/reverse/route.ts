import { NextResponse } from 'next/server';
import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const paymentMethodSet = new Set(Object.values(PaymentMethod));

const reversalInclude = {
  attendant: true,
  items: {
    include: {
      product: true,
    },
  },
} as const satisfies Prisma.SaleInclude;

type ReversalSaleWithRelations = Prisma.SaleGetPayload<{ include: typeof reversalInclude }>;

type ReverseItemRequest = {
  saleItemId?: string;
  productId: string;
  quantity: number;
};

function toCents(value: number) {
  return Math.round(value * 100);
}

function centsToAmount(cents: number) {
  return cents / 100;
}

function parseSaleIdFromReversalReceipt(receiptNumber: string) {
  if (!receiptNumber.startsWith('REV-')) {
    return null;
  }

  const rest = receiptNumber.slice(4);
  const [saleId] = rest.split('-');
  return saleId || null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, paymentMethod, items } = body ?? {};
    const itemsProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, 'items'));

    if (!id) {
      return NextResponse.json({ error: 'Sale id is required.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    let normalizedPaymentMethod: PaymentMethod | null = null;
    if (paymentMethod !== undefined && paymentMethod !== null && String(paymentMethod).trim().length > 0) {
      const candidate = String(paymentMethod).toUpperCase() as PaymentMethod;
      if (!paymentMethodSet.has(candidate)) {
        return NextResponse.json({ error: 'paymentMethod is invalid.' }, { status: 400 });
      }
      normalizedPaymentMethod = candidate;
    }

    const requestedItems: ReverseItemRequest[] = Array.isArray(items)
      ? items
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            saleItemId: item.saleItemId ? String(item.saleItemId) : undefined,
            productId: String(item.productId ?? ''),
            quantity: Number(item.quantity),
          }))
          .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0)
      : [];

    if (itemsProvided && requestedItems.length === 0) {
      return NextResponse.json({ error: 'Select at least one item to reverse.' }, { status: 400 });
    }

    const reversalSale = (await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!sale) {
        throw new Error('Sale not found.');
      }

      if (sale.receiptNumber.startsWith('REV-')) {
        throw new Error('Cannot reverse a reversal sale.');
      }

      const existingReversals = await tx.sale.findMany({
        where: {
          receiptNumber: { startsWith: `REV-${id}-` },
        },
        include: { items: true },
      });

      const reversedQuantityByKey = new Map<string, number>();
      for (const reversal of existingReversals) {
        for (const item of reversal.items) {
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity === 0) {
            continue;
          }
          const reversed = -quantity;
          if (reversed <= 0) {
            continue;
          }

          const key = `${item.productId}:${toCents(Number(item.price))}`;
          reversedQuantityByKey.set(key, (reversedQuantityByKey.get(key) ?? 0) + reversed);
        }
      }

      const requestedQuantityBySaleItemId = new Map<string, number>();
      const requestedQuantityByProductId = new Map<string, number>();
      for (const item of requestedItems) {
        if (item.saleItemId) {
          requestedQuantityBySaleItemId.set(
            item.saleItemId,
            (requestedQuantityBySaleItemId.get(item.saleItemId) ?? 0) + item.quantity,
          );
          continue;
        }

        requestedQuantityByProductId.set(
          item.productId,
          (requestedQuantityByProductId.get(item.productId) ?? 0) + item.quantity,
        );
      }

      const linesToReverse: {
        productId: string;
        quantityToReverse: number;
        unitPrice: number;
      }[] = [];

      const originalSubtotalCents = toCents(Number(sale.subtotal));
      const originalDiscountCents = toCents(Number(sale.discount ?? 0));

      const remainingRequestedByProductId = new Map(requestedQuantityByProductId);
      const remainingReversedToAllocateByKey = new Map(reversedQuantityByKey);

      for (const saleItem of sale.items) {
        const soldQuantity = Number(saleItem.quantity);
        const key = `${saleItem.productId}:${toCents(Number(saleItem.price))}`;
        const remainingReversalForKey = remainingReversedToAllocateByKey.get(key) ?? 0;
        const alreadyReversedForLine = Math.min(Math.max(remainingReversalForKey, 0), Math.max(soldQuantity, 0));
        remainingReversedToAllocateByKey.set(key, remainingReversalForKey - alreadyReversedForLine);
        const remaining = soldQuantity - alreadyReversedForLine;

        const requestedForLine = requestedQuantityBySaleItemId.has(saleItem.id)
          ? requestedQuantityBySaleItemId.get(saleItem.id)!
          : null;

        const requestedForProduct = remainingRequestedByProductId.has(saleItem.productId)
          ? remainingRequestedByProductId.get(saleItem.productId)!
          : null;

        const quantityToReverse =
          requestedForLine !== null
            ? requestedForLine
            : requestedForProduct !== null
              ? Math.min(requestedForProduct, remaining)
              : itemsProvided
                ? 0
                : remaining;

        if (!Number.isFinite(quantityToReverse) || quantityToReverse <= 0) {
          continue;
        }

        if (quantityToReverse > remaining) {
          throw new Error('Requested reversal quantity exceeds remaining sold quantity.');
        }

        if (requestedForProduct !== null && !requestedQuantityBySaleItemId.has(saleItem.id)) {
          remainingRequestedByProductId.set(saleItem.productId, requestedForProduct - quantityToReverse);
        }

        linesToReverse.push({
          productId: saleItem.productId,
          quantityToReverse,
          unitPrice: Number(saleItem.price),
        });
      }

      if (requestedItems.length > 0) {
        for (const item of requestedItems) {
          if (item.saleItemId) {
            if (!sale.items.find((saleItem) => saleItem.id === item.saleItemId)) {
              throw new Error('Requested reversal item is not part of the sale.');
            }
            continue;
          }

          if (!sale.items.find((saleItem) => saleItem.productId === item.productId)) {
            throw new Error('Requested reversal item is not part of the sale.');
          }
        }

        for (const [productId, remaining] of remainingRequestedByProductId.entries()) {
          if (remaining > 0) {
            throw new Error('Requested reversal quantity exceeds remaining sold quantity.');
          }
        }
      }

      if (linesToReverse.length === 0) {
        throw new Error('There is nothing left to reverse for this sale.');
      }

      let reversedSubtotalCents = 0;
      let reversedDiscountCents = 0;

      const reversalItemsPayload = linesToReverse.map((line) => {
        const unitPriceCents = toCents(line.unitPrice);
        const lineSubtotalCents = Math.round(unitPriceCents * line.quantityToReverse);
        reversedSubtotalCents += lineSubtotalCents;

        const lineDiscountCents =
          originalSubtotalCents > 0 ? Math.round((lineSubtotalCents * originalDiscountCents) / originalSubtotalCents) : 0;
        reversedDiscountCents += lineDiscountCents;

        return {
          productId: line.productId,
          quantity: -line.quantityToReverse,
          price: centsToAmount(unitPriceCents),
          total: centsToAmount(-lineSubtotalCents),
        };
      });

      const reversalSubtotal = centsToAmount(-reversedSubtotalCents);
      const reversalDiscount = centsToAmount(-reversedDiscountCents);
      const reversalTotalAmount = centsToAmount(-(reversedSubtotalCents - reversedDiscountCents));

      const incrementByProductId = new Map<string, number>();
      for (const line of linesToReverse) {
        incrementByProductId.set(
          line.productId,
          (incrementByProductId.get(line.productId) ?? 0) + line.quantityToReverse,
        );
      }

      const stockBeforeByProductId = new Map<string, number>();
      for (const [productId] of incrementByProductId.entries()) {
        const stock = await tx.stock.findUnique({ where: { productId } });
        if (!stock) {
          throw new Error('Stock record is missing for a product in this sale.');
        }
        stockBeforeByProductId.set(productId, Number(stock.quantity));
      }

      const receiptNumber = `REV-${id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const createdReversal = await tx.sale.create({
        data: {
          receiptNumber,
          userId,
          subtotal: reversalSubtotal,
          discount: reversalDiscount,
          totalAmount: reversalTotalAmount,
          paymentMethod: normalizedPaymentMethod ?? sale.paymentMethod,
          createdAt: sale.createdAt,
          items: {
            create: reversalItemsPayload,
          },
        },
        include: reversalInclude,
      });

      await Promise.all(
        Array.from(incrementByProductId.entries()).map(async ([productId, quantity]) => {
          const quantityBefore = stockBeforeByProductId.get(productId) ?? 0;
          const quantityChange = Number(quantity.toFixed(2));
          const quantityAfter = Number((quantityBefore + quantityChange).toFixed(2));

          await tx.stock.update({
            where: { productId },
            data: { quantity: { increment: quantity } },
          });

          await (tx as any).stockAdjustment.create({
            data: {
              productId,
              type: 'SALE_REVERSAL',
              quantityBefore,
              quantityAfter,
              quantityChange,
              userId: String(userId),
            },
          });
        }),
      );

      return createdReversal;
      },
      {
        timeout: 60000,
      },
    )) as ReversalSaleWithRelations;

    const reversesSaleId = parseSaleIdFromReversalReceipt(reversalSale.receiptNumber);

    return NextResponse.json(
      {
        reversal: {
          id: reversalSale.id,
          receiptNumber: reversalSale.receiptNumber,
          reversesSaleId,
          userId: reversalSale.userId,
          paymentMethod: reversalSale.paymentMethod,
          subtotal: Number(reversalSale.subtotal),
          discount: Number(reversalSale.discount ?? 0),
          totalAmount: Number(reversalSale.totalAmount),
          createdAt: reversalSale.createdAt,
          items: reversalSale.items.map((item) => ({
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
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Failed to reverse sale', error);

    if (error instanceof Error && error.message) {
      const known =
        error.message.includes('Sale not found') ||
        error.message.includes('Cannot reverse a reversal sale') ||
        error.message.includes('nothing left to reverse') ||
        error.message.includes('exceeds remaining') ||
        error.message.includes('not part of the sale') ||
        error.message.includes('Stock record is missing');

      if (known) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Unable to reverse sale.' }, { status: 500 });
  }
}
