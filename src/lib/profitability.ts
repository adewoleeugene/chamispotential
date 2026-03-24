type InventoryPurchaseLike = {
  inventoryId: string;
  quantity: number;
  unitCost: number;
  totalCost?: number | null;
  purchasedAt: Date;
};

type InventoryCostFallback = {
  id: string;
  cost?: number | null;
};

type RecipeIngredientLike = {
  inventoryId: string;
  quantityUsed: number;
};

type OrderRemovalLike = {
  inventoryId: string;
  quantityUsed: number;
};

type OrderAdditionLike = {
  inventoryId: string;
  quantityUsed: number;
};

type OrderItemLike = {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  menuItem: {
    id: string;
    name: string;
    category?: { name?: string | null } | null;
    recipeIngredients?: RecipeIngredientLike[];
  };
  removals?: OrderRemovalLike[];
  additions?: OrderAdditionLike[];
};

export type InventoryCostSnapshot = {
  inventoryId: string;
  weightedAverageCost: number;
  latestUnitCost: number | null;
  totalPurchasedQuantity: number;
  totalPurchasedCost: number;
  lastPurchasedAt: Date | null;
};

export type OrderItemProfitability = {
  id: string;
  menuItemId: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  estimatedCost: number;
  grossProfit: number;
  grossMarginPct: number;
};

export type CostMethod = 'weighted_average_as_of_sale_date' | 'fifo' | 'lifo';

export function buildOrderItemIngredientUsage(item: OrderItemLike) {
  const ingredientUsage = new Map<string, number>();

  for (const ingredient of item.menuItem.recipeIngredients || []) {
    ingredientUsage.set(
      ingredient.inventoryId,
      (ingredientUsage.get(ingredient.inventoryId) || 0) + (ingredient.quantityUsed * item.quantity)
    );
  }

  for (const removal of item.removals || []) {
    ingredientUsage.set(
      removal.inventoryId,
      (ingredientUsage.get(removal.inventoryId) || 0) - (removal.quantityUsed * item.quantity)
    );
  }

  for (const addition of item.additions || []) {
    ingredientUsage.set(
      addition.inventoryId,
      (ingredientUsage.get(addition.inventoryId) || 0) + (addition.quantityUsed * item.quantity)
    );
  }

  return ingredientUsage;
}

export function buildInventoryCostMap(
  purchases: InventoryPurchaseLike[],
  fallbackCosts: InventoryCostFallback[],
  asOf?: Date
) {
  const costMap = new Map<string, InventoryCostSnapshot>();
  const fallbackMap = new Map(fallbackCosts.map((item) => [item.id, item.cost ?? 0]));

  for (const purchase of purchases) {
    if (asOf && purchase.purchasedAt > asOf) {
      continue;
    }

    const existing = costMap.get(purchase.inventoryId) ?? {
      inventoryId: purchase.inventoryId,
      weightedAverageCost: fallbackMap.get(purchase.inventoryId) ?? 0,
      latestUnitCost: null,
      totalPurchasedQuantity: 0,
      totalPurchasedCost: 0,
      lastPurchasedAt: null,
    };

    existing.totalPurchasedQuantity += purchase.quantity;
    existing.totalPurchasedCost += purchase.totalCost ?? purchase.quantity * purchase.unitCost;
    existing.latestUnitCost = purchase.unitCost;
    existing.lastPurchasedAt = purchase.purchasedAt;
    existing.weightedAverageCost = existing.totalPurchasedQuantity > 0
      ? existing.totalPurchasedCost / existing.totalPurchasedQuantity
      : (fallbackMap.get(purchase.inventoryId) ?? 0);

    costMap.set(purchase.inventoryId, existing);
  }

  for (const fallback of fallbackCosts) {
    if (!costMap.has(fallback.id)) {
      costMap.set(fallback.id, {
        inventoryId: fallback.id,
        weightedAverageCost: fallback.cost ?? 0,
        latestUnitCost: fallback.cost ?? null,
        totalPurchasedQuantity: 0,
        totalPurchasedCost: 0,
        lastPurchasedAt: null,
      });
    }
  }

  return costMap;
}

export function calculateOrderItemIngredientCost(
  item: OrderItemLike,
  inventoryCostMap: Map<string, InventoryCostSnapshot>
) {
  const ingredientUsage = buildOrderItemIngredientUsage(item);

  let estimatedCost = 0;
  for (const [inventoryId, quantityUsed] of ingredientUsage.entries()) {
    if (quantityUsed <= 0) {
      continue;
    }
    const unitCost = inventoryCostMap.get(inventoryId)?.weightedAverageCost ?? 0;
    estimatedCost += quantityUsed * unitCost;
  }

  return estimatedCost;
}

export function calculateOrderItemProfitability(
  item: OrderItemLike,
  inventoryCostMap: Map<string, InventoryCostSnapshot>
): OrderItemProfitability {
  const revenue = item.quantity * item.unitPrice;
  const estimatedCost = calculateOrderItemIngredientCost(item, inventoryCostMap);
  const grossProfit = revenue - estimatedCost;

  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.menuItem.name,
    category: item.menuItem.category?.name || 'Uncategorised',
    quantity: item.quantity,
    revenue,
    estimatedCost,
    grossProfit,
    grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
  };
}

export function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}
