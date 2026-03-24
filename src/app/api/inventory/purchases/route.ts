import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { parseDateInput } from '@/lib/date-only';

function normalizePurchasePayload(input: Record<string, unknown>) {
  const quantity = Number(input.quantity);
  const unitCost = Number(input.unitCost);
  const purchasedAt = parseDateInput(input.purchasedAt);

  return {
    inventoryId: String(input.inventoryId ?? '').trim(),
    quantity: Number.isFinite(quantity) ? quantity : NaN,
    unitCost: Number.isFinite(unitCost) ? unitCost : NaN,
    supplier: String(input.supplier ?? '').trim() || null,
    notes: String(input.notes ?? '').trim() || null,
    purchasedAt,
  };
}

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const purchases = await prisma.inventoryPurchase.findMany({
    orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      inventory: {
        select: { id: true, name: true, unit: true, category: true },
      },
    },
    take: 100,
  });

  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user || !['admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = normalizePurchasePayload(await req.json());
  if (!payload.inventoryId || !Number.isFinite(payload.quantity) || payload.quantity <= 0 || !Number.isFinite(payload.unitCost) || payload.unitCost < 0 || !payload.purchasedAt) {
    return NextResponse.json({ error: 'Inventory item, purchase date, quantity, and unit cost are required' }, { status: 400 });
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const totalCost = Number((payload.quantity * payload.unitCost).toFixed(2));
    const purchasedAt = payload.purchasedAt as Date;

    const createdPurchase = await tx.inventoryPurchase.create({
      data: {
        inventoryId: payload.inventoryId,
        quantity: payload.quantity,
        unitCost: payload.unitCost,
        totalCost,
        supplier: payload.supplier,
        notes: payload.notes,
        purchasedAt,
      },
      include: {
        inventory: {
          select: { id: true, name: true, unit: true, category: true },
        },
      },
    });

    await tx.inventory.update({
      where: { id: payload.inventoryId },
        data: {
          currentStock: { increment: payload.quantity },
          cost: payload.unitCost,
          supplier: payload.supplier,
          lastRestocked: purchasedAt,
        },
      });

    return createdPurchase;
  });

  return NextResponse.json(purchase, { status: 201 });
}
