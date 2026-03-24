type PersistedOrderLineItem = {
  menuItemId: string;
  quantity: number;
  menuItem?: {
    recipeIngredients?: RecipeIngredientRecord[];
  };
  removals?: Array<{
    inventoryId: string;
    quantityUsed: number;
  }>;
  additions?: Array<{
    inventoryId: string;
    quantityUsed: number;
  }>;
};

type RecipeIngredientRecord = {
  menuItemId: string;
  inventoryId: string;
  quantityUsed: number;
};

type InventoryMutationClient = {
  recipeIngredient: {
    findMany: (args: {
      where: { menuItemId: { in: string[] } };
    }) => Promise<RecipeIngredientRecord[]>;
  };
  inventory: {
    update: (args: {
      where: { id: string };
      data: { currentStock: { increment?: number; decrement?: number } };
    }) => Promise<unknown>;
  };
  $executeRawUnsafe?: (query: string, ...values: Array<string | number>) => Promise<unknown>;
};

async function getEffectiveUsageByInventory(
  db: InventoryMutationClient,
  items: PersistedOrderLineItem[]
): Promise<Map<string, number>> {
  const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];

  if (menuItemIds.length === 0) {
    return new Map();
  }

  const providedRecipeIngredients = items.flatMap((item) => item.menuItem?.recipeIngredients || []);
  const recipeIngredients = providedRecipeIngredients.length > 0
    ? providedRecipeIngredients
    : await db.recipeIngredient.findMany({
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

    for (const removal of item.removals || []) {
      const totalRemoved = removal.quantityUsed * item.quantity;
      usage.set(
        removal.inventoryId,
        (usage.get(removal.inventoryId) || 0) - totalRemoved
      );
    }

    for (const addition of item.additions || []) {
      const totalAdded = addition.quantityUsed * item.quantity;
      usage.set(
        addition.inventoryId,
        (usage.get(addition.inventoryId) || 0) + totalAdded
      );
    }
  }

  return usage;
}

async function applyUsageDelta(
  db: InventoryMutationClient,
  deltaByInventoryId: Map<string, number>
) {
  const updates = [...deltaByInventoryId.entries()].filter(([, delta]) => delta !== 0);

  if (updates.length === 0) {
    return;
  }

  if (typeof db.$executeRawUnsafe === 'function') {
    const values: Array<string | number> = [];
    const cases: string[] = [];
    const whereIds: string[] = [];

    for (const [inventoryId, delta] of updates) {
      const idPlaceholder = `$${values.length + 1}`;
      values.push(inventoryId);
      const deltaPlaceholder = `$${values.length + 1}`;
      values.push(delta);

      cases.push(`WHEN ${idPlaceholder} THEN "currentStock" + ${deltaPlaceholder}`);
      whereIds.push(idPlaceholder);
    }

    await db.$executeRawUnsafe(
      `UPDATE "Inventory"
       SET "currentStock" = CASE "id"
         ${cases.join(' ')}
         ELSE "currentStock"
       END
       WHERE "id" IN (${whereIds.join(', ')})`,
      ...values
    );
    return;
  }

  await Promise.all(updates.map(([inventoryId, delta]) => db.inventory.update({
    where: { id: inventoryId },
    data:
      delta > 0
        ? { currentStock: { increment: delta } }
        : { currentStock: { decrement: Math.abs(delta) } },
  })));
}

export async function consumeInventoryForOrder(
  db: InventoryMutationClient,
  items: PersistedOrderLineItem[]
) {
  const usage = await getEffectiveUsageByInventory(db, items);
  const stockDelta = new Map(
    [...usage.entries()].map(([inventoryId, quantityUsed]) => [inventoryId, -quantityUsed])
  );

  await applyUsageDelta(db, stockDelta);
}

export async function restoreInventoryForOrder(
  db: InventoryMutationClient,
  items: PersistedOrderLineItem[]
) {
  const usage = await getEffectiveUsageByInventory(db, items);
  await applyUsageDelta(db, usage);
}

export async function reconcileInventoryForOrderEdit(
  db: InventoryMutationClient,
  previousItems: PersistedOrderLineItem[],
  nextItems: PersistedOrderLineItem[]
) {
  const [previousUsage, nextUsage] = await Promise.all([
    getEffectiveUsageByInventory(db, previousItems),
    getEffectiveUsageByInventory(db, nextItems),
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
