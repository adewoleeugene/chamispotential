import type { Prisma, PrismaClient } from '@prisma/client';
import { consumeInventoryForOrder } from '@/lib/inventory';
import { getTaxRateDecimal } from '@/lib/runtime-settings';

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
};

export type CreateOrderInput = {
  tableId?: string | null;
  userId: string;
  type?: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  discount?: number;
  paymentMethod?: string | null;
  paymentStatus?: string;
  status?: string;
  applySideEffects?: boolean;
  items: OrderItemInput[];
};

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export async function buildOrderPricing(tx: PrismaTx, items: OrderItemInput[], discount = 0) {
  const menuItems = await tx.menuItem.findMany({
    where: { id: { in: items.map((item) => item.menuItemId) } },
  });

  const itemMap = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));
  const orderItems = items.map((item) => {
    const menuItem = itemMap.get(item.menuItemId);

    if (!menuItem) {
      throw new Error(`MENU_ITEM_NOT_FOUND:${item.menuItemId}`);
    }

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: menuItem.price,
      notes: item.notes,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmt = discount || 0;
  const taxRate = await getTaxRateDecimal();
  const tax = (subtotal - discountAmt) * taxRate;
  const total = subtotal + tax - discountAmt;

  return { orderItems, subtotal, discountAmt, tax, total };
}

export async function getNextOrderNumber(tx: PrismaTx) {
  const lastOrder = await tx.order.findFirst({ orderBy: { orderNumber: 'desc' } });
  return (lastOrder?.orderNumber || 1000) + 1;
}

export async function createOrderWithItems(tx: PrismaTx, input: CreateOrderInput) {
  const { orderItems, subtotal, discountAmt, tax, total } = await buildOrderPricing(tx, input.items, input.discount);
  const orderNumber = await getNextOrderNumber(tx);

  const createdOrder = await tx.order.create({
    data: {
      orderNumber,
      tableId: input.tableId || null,
      userId: input.userId,
      type: input.type || 'dine-in',
      notes: input.notes,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      status: input.status || 'pending',
      subtotal,
      tax,
      discount: discountAmt,
      total,
      paymentMethod: input.paymentMethod || null,
      paymentStatus: input.paymentStatus || 'unpaid',
      items: { create: orderItems },
    },
    include: {
      table: true,
      user: { select: { name: true, id: true } },
      items: { include: { menuItem: true } },
    },
  });

  if (input.applySideEffects !== false) {
    await consumeInventoryForOrder(tx, input.items);

    if (input.tableId) {
      await tx.table.update({
        where: { id: input.tableId },
        data: { status: 'occupied' },
      });
    }
  }

  return createdOrder;
}

export function isOperationalOrderStatus(status: string) {
  return ['pending', 'preparing', 'ready', 'served', 'completed'].includes(status);
}

export async function activateOrderForService(tx: PrismaTx, orderId: string) {
  const existingOrder = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!existingOrder) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (!isOperationalOrderStatus(existingOrder.status)) {
    await consumeInventoryForOrder(
      tx,
      existingOrder.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
    );

    if (existingOrder.tableId) {
      await tx.table.update({
        where: { id: existingOrder.tableId },
        data: { status: 'occupied' },
      });
    }
  }

  return tx.order.update({
    where: { id: orderId },
    data: {
      status: 'pending',
    },
    include: {
      table: true,
      user: { select: { name: true, id: true } },
      items: { include: { menuItem: true } },
    },
  });
}
