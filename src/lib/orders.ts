import type { Prisma, PrismaClient } from '@prisma/client';
import { consumeInventoryForOrder } from '@/lib/inventory';
import { getTaxRateDecimal } from '@/lib/runtime-settings';
import type { OrderItemInput } from '@/lib/order-customization';
import { hasDuplicateValues } from '@/lib/order-customization';

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

const orderItemResponseInclude = {
  menuItem: true,
  removals: { include: { recipeIngredient: { include: { inventory: true } } } },
  additions: { include: { menuItemExtraOption: { include: { inventory: true } } } },
} as const;

export async function buildCustomizationCreates(tx: PrismaTx, items: OrderItemInput[]) {
  const recipeIngredientIds = [...new Set(items.flatMap((item) => (item.removals || []).map((removal) => removal.recipeIngredientId)))];
  const extraOptionIds = [...new Set(items.flatMap((item) => (item.additions || []).map((addition) => addition.menuItemExtraOptionId)))];

  const [recipeIngredients, extraOptions] = await Promise.all([
    recipeIngredientIds.length > 0
      ? tx.recipeIngredient.findMany({
        where: { id: { in: recipeIngredientIds } },
        include: { inventory: true },
      })
      : Promise.resolve([]),
    extraOptionIds.length > 0
      ? tx.menuItemExtraOption.findMany({
        where: { id: { in: extraOptionIds }, isActive: true },
        include: { inventory: true },
      })
      : Promise.resolve([]),
  ]);

  const recipeMap = new Map(recipeIngredients.map((recipe) => [recipe.id, recipe]));
  const extraMap = new Map(extraOptions.map((extra) => [extra.id, extra]));

  return items.map((item) => {
    const removalIds = (item.removals || []).map((removal) => removal.recipeIngredientId);
    const additionIds = (item.additions || []).map((addition) => addition.menuItemExtraOptionId);

    if (hasDuplicateValues(removalIds)) {
      throw new Error(`DUPLICATE_REMOVALS:${item.menuItemId}`);
    }

    if (hasDuplicateValues(additionIds)) {
      throw new Error(`DUPLICATE_ADDITIONS:${item.menuItemId}`);
    }

    const removals = removalIds.map((removalId) => {
      const recipe = recipeMap.get(removalId);

      if (!recipe || recipe.menuItemId !== item.menuItemId) {
        throw new Error(`INVALID_REMOVAL:${removalId}`);
      }

      return {
        recipeIngredientId: recipe.id,
        inventoryId: recipe.inventoryId,
        labelSnapshot: recipe.inventory.name,
        quantityUsed: recipe.quantityUsed,
      };
    });

    const additions = additionIds.map((additionId) => {
      const extra = extraMap.get(additionId);

      if (!extra || extra.menuItemId !== item.menuItemId) {
        throw new Error(`INVALID_ADDITION:${additionId}`);
      }

      return {
        menuItemExtraOptionId: extra.id,
        inventoryId: extra.inventoryId,
        labelSnapshot: extra.label,
        quantityUsed: extra.quantityUsed,
      };
    });

    return { removals, additions };
  });
}

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
      kitchenNote: item.kitchenNote,
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
  const customizationCreates = await buildCustomizationCreates(tx, input.items);
  const orderNumber = await getNextOrderNumber(tx);
  const initialStatus = input.status || 'pending';
  const initialPaymentStatus = input.paymentStatus || 'unpaid';

  const createdOrder = await tx.order.create({
    data: {
      orderNumber,
      tableId: input.tableId || null,
      userId: input.userId,
      type: input.type || 'dine-in',
      notes: input.notes,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      status: initialStatus,
      subtotal,
      tax,
      discount: discountAmt,
      total,
      paymentMethod: input.paymentMethod || null,
      paymentStatus: initialPaymentStatus,
      ...(shouldStartOrderService(initialStatus) ? { serviceStartedAt: new Date() } : {}),
      items: { create: orderItems },
    },
    include: {
      table: true,
      user: { select: { name: true, id: true } },
      items: {
        include: {
          menuItem: { include: { recipeIngredients: true } },
        },
      },
    },
  });

  await Promise.all(
    createdOrder.items.flatMap((orderItem, index) => {
      const removals = (customizationCreates[index]?.removals || []).map((removal) => tx.orderItemRemoval.create({
        data: {
          ...removal,
          orderItemId: orderItem.id,
        },
      }));
      const additions = (customizationCreates[index]?.additions || []).map((addition) => tx.orderItemAddition.create({
        data: {
          ...addition,
          orderItemId: orderItem.id,
        },
      }));

      return [...removals, ...additions];
    })
  );

  if (input.applySideEffects !== false) {
    await consumeInventoryForOrder(tx, createdOrder.items.map((orderItem, index) => ({
      ...orderItem,
      removals: customizationCreates[index]?.removals || [],
      additions: customizationCreates[index]?.additions || [],
    })));

    if (input.tableId) {
      await tx.table.update({
        where: { id: input.tableId },
        data: { status: 'occupied' },
      });
    }
  }

  return tx.order.findUniqueOrThrow({
    where: { id: createdOrder.id },
    include: {
      table: true,
      user: { select: { name: true, id: true } },
      items: { include: orderItemResponseInclude },
    },
  });
}

export function isOperationalOrderStatus(status: string) {
  return ['pending', 'preparing', 'ready', 'served', 'completed'].includes(status);
}

export function shouldStartOrderService(status: string) {
  return ['payment_pending_confirmation', 'pending', 'preparing', 'ready', 'served', 'completed'].includes(status);
}

export function shouldStartKitchenService(status: string) {
  return ['preparing', 'ready', 'served', 'completed'].includes(status);
}

export function shouldCloseOrderService(order: { status: string; serviceStartedAt?: Date | null }) {
  return Boolean(order.serviceStartedAt) || shouldStartOrderService(order.status);
}

export function shouldAutoCompleteServedOrder(order: { paymentStatus?: string | null }) {
  return order.paymentStatus === 'paid';
}

export async function moveTableToCleaningIfNoActiveOrders(tx: PrismaTx, tableId: string | null | undefined) {
  if (!tableId) {
    return;
  }

  const activeOrders = await tx.order.count({
    where: {
      tableId,
      status: { in: ['pending', 'preparing', 'ready', 'served'] },
    },
  });

  if (activeOrders === 0) {
    await tx.table.update({
      where: { id: tableId },
      data: { status: 'cleaning' },
    });
  }
}

export async function activateOrderForService(tx: PrismaTx, orderId: string) {
  const existingOrder = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          menuItem: { include: { recipeIngredients: true } },
          removals: { include: { recipeIngredient: true } },
          additions: { include: { menuItemExtraOption: true } },
        },
      },
    },
  });

  if (!existingOrder) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (!isOperationalOrderStatus(existingOrder.status)) {
    await consumeInventoryForOrder(
      tx,
      existingOrder.items
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
      items: { include: orderItemResponseInclude },
    },
  });
}
