type OrderLineItem = {
  menuItemId: string;
  quantity: number;
};

type InventoryMutationClient = {
  recipeIngredient: {
    findMany: (args: {
      where: { menuItemId: { in: string[] } };
    }) => Promise<Array<{ menuItemId: string; inventoryId: string; quantityUsed: number }>>;
  };
  inventory: {
    update: (args: {
      where: { id: string };
      data: { currentStock: { increment?: number; decrement?: number } };
    }) => Promise<unknown>;
  };
};

async function getRecipeUsageByInventory(
  db: InventoryMutationClient,
  items: OrderLineItem[]
): Promise<Map<string, number>> {
  const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];

  if (menuItemIds.length === 0) {
    return new Map();
  }

  const recipeIngredients = await db.recipeIngredient.findMany({
    where: { menuItemId: { in: menuItemIds } },
  });

  const usage = new Map<string, number>();

  for (const item of items) {
    const recipeLines = recipeIngredients.filter(
      (ingredient) => ingredient.menuItemId === item.menuItemId
    );

    for (const recipeLine of recipeLines) {
      const totalUsed = recipeLine.quantityUsed * item.quantity;
      usage.set(
        recipeLine.inventoryId,
        (usage.get(recipeLine.inventoryId) || 0) + totalUsed
      );
    }
  }

  return usage;
}

async function applyUsageDelta(
  db: InventoryMutationClient,
  deltaByInventoryId: Map<string, number>
) {
  for (const [inventoryId, delta] of deltaByInventoryId.entries()) {
    if (delta === 0) continue;

    await db.inventory.update({
      where: { id: inventoryId },
      data:
        delta > 0
          ? { currentStock: { increment: delta } }
          : { currentStock: { decrement: Math.abs(delta) } },
    });
  }
}

export async function consumeInventoryForOrder(
  db: InventoryMutationClient,
  items: OrderLineItem[]
) {
  const usage = await getRecipeUsageByInventory(db, items);
  const stockDelta = new Map(
    [...usage.entries()].map(([inventoryId, quantityUsed]) => [inventoryId, -quantityUsed])
  );

  await applyUsageDelta(db, stockDelta);
}

export async function restoreInventoryForOrder(
  db: InventoryMutationClient,
  items: OrderLineItem[]
) {
  const usage = await getRecipeUsageByInventory(db, items);
  await applyUsageDelta(db, usage);
}

export async function reconcileInventoryForOrderEdit(
  db: InventoryMutationClient,
  previousItems: OrderLineItem[],
  nextItems: OrderLineItem[]
) {
  const [previousUsage, nextUsage] = await Promise.all([
    getRecipeUsageByInventory(db, previousItems),
    getRecipeUsageByInventory(db, nextItems),
  ]);

  const inventoryIds = new Set([
    ...previousUsage.keys(),
    ...nextUsage.keys(),
  ]);

  const stockDelta = new Map<string, number>();

  for (const inventoryId of inventoryIds) {
    const oldUsage = previousUsage.get(inventoryId) || 0;
    const newUsage = nextUsage.get(inventoryId) || 0;
    stockDelta.set(inventoryId, oldUsage - newUsage);
  }

  await applyUsageDelta(db, stockDelta);
}
