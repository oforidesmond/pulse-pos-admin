import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const pageParam = Number(searchParams.get('page') ?? '1');
    const pageSizeParam = Number(searchParams.get('pageSize') ?? '25');
    const search = (searchParams.get('search') ?? '').trim();

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const rawPageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 25;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { stock: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return NextResponse.json({
      products: products.map(formatProduct),
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Failed to fetch products', error);
    return NextResponse.json({ error: 'Unable to fetch products.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, sku, costPrice, sellingPrice, stock, userId } = await request.json();

    if (!name || !sku) {
      return NextResponse.json({ error: 'Name and SKU are required.' }, { status: 400 });
    }

    if (costPrice === undefined || sellingPrice === undefined) {
      return NextResponse.json({ error: 'Cost and selling price are required.' }, { status: 400 });
    }

    const parsedCost = Number(costPrice);
    const parsedSelling = Number(sellingPrice);
    const parsedStock = stock !== undefined ? Number(stock) : 0;

    if ([parsedCost, parsedSelling].some((value) => Number.isNaN(value))) {
      return NextResponse.json({ error: 'Cost and selling price must be numbers.' }, { status: 400 });
    }

    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      return NextResponse.json({ error: 'Stock must be a non-negative number.' }, { status: 400 });
    }

    const product = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdProduct = await tx.product.create({
        data: {
          name,
          sku,
          cost: parsedCost,
          price: parsedSelling,
          stock: {
            create: {
              quantity: parsedStock,
            },
          },
        },
        include: { stock: true },
      });

      await (tx as any).stockAdjustment.create({
        data: {
          productId: createdProduct.id,
          type: 'INITIAL_STOCK',
          quantityBefore: 0,
          quantityAfter: parsedStock,
          quantityChange: parsedStock,
          userId: userId ? String(userId) : null,
        },
      });

      return createdProduct;
    });

    return NextResponse.json({ product: formatProduct(product) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create product', error);
    const message = error?.meta?.target?.includes('sku') ? 'SKU must be unique.' : 'Unable to create product.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
