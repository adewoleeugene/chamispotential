import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns';
import {
  type CostMethod,
  buildOrderItemIngredientUsage,
  buildInventoryCostMap,
  calculateOrderItemProfitability,
  sumBy,
  type OrderItemProfitability,
} from '@/lib/profitability';
import { isRecognizedRevenueOrder } from '@/lib/revenue';

export type ReportRange = 'day' | 'week' | 'month' | 'custom';

type AnalyticsOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  type: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: Date;
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    unitPrice: number;
    menuItem: {
      id: string;
      name: string;
      category?: { name?: string | null } | null;
      recipeIngredients?: Array<{
        inventoryId: string;
        quantityUsed: number;
      }>;
    };
    removals?: Array<{
      inventoryId: string;
      quantityUsed: number;
    }>;
    additions?: Array<{
      inventoryId: string;
      quantityUsed: number;
    }>;
  }>;
};

type AnalyticsPurchase = {
  inventoryId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchasedAt: Date;
  inventory?: {
    id: string;
    name: string;
    unit: string;
    category?: string | null;
  } | null;
  supplier?: string | null;
  notes?: string | null;
};

type AnalyticsInventory = {
  id: string;
  cost: number | null;
  name?: string;
  unit?: string;
  category?: string | null;
};

type InventoryLayer = {
  remainingQuantity: number;
  unitCost: number;
};

export type Bucket = {
  key: string;
  label: string;
  revenue: number;
  netSales: number;
  cogs: number;
  ingredientSpend: number;
  grossProfit: number;
  orders: number;
};

export type PurchaseBreakdownRow = {
  inventoryId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  totalCost: number;
  purchaseCount: number;
  averageUnitCost: number;
  supplierCount: number;
  lastPurchasedAt: string | null;
  spendSharePct: number;
};

export type SupplierSpendRow = {
  supplier: string;
  totalCost: number;
  purchaseCount: number;
  sharePct: number;
};

export type RecentPurchaseRow = {
  inventoryId: string;
  inventoryName: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string | null;
  notes: string | null;
  purchasedAt: string;
};

export type PeriodComparisonSummary = {
  range: Exclude<ReportRange, 'custom'>;
  label: string;
  shortLabel: string;
  netSales: number;
  ingredientSpend: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOrders: number;
  topPurchasedIngredient: string;
  topPurchasedIngredientSpend: number;
  spendConcentrationPct: number;
};

export type PurchaseAnalytics = {
  totalSpend: number;
  purchasesByIngredient: PurchaseBreakdownRow[];
  supplierSpend: SupplierSpendRow[];
  recentPurchases: RecentPurchaseRow[];
  topPurchasedIngredients: PurchaseBreakdownRow[];
  spendConcentrationPct: number;
};

export type PreviousPeriodComparison = {
  currentLabel: string;
  previousLabel: string;
  metrics: {
    netSales: { current: number; previous: number; delta: number; deltaPct: number | null };
    ingredientSpend: { current: number; previous: number; delta: number; deltaPct: number | null };
    grossProfit: { current: number; previous: number; delta: number; deltaPct: number | null };
    grossMarginPct: { current: number; previous: number; delta: number; deltaPct: number | null };
    totalOrders: { current: number; previous: number; delta: number; deltaPct: number | null };
  };
};

export type PurchaseHistoryRow = {
  key: string;
  label: string;
  totalSpend: number;
  purchaseCount: number;
  topIngredient: string;
  topSupplier: string;
};

export type CostAuditRow = {
  orderId: string;
  orderNumber: number;
  soldAt: string;
  itemName: string;
  ingredientName: string;
  ingredientUnit: string;
  quantityUsed: number;
  saleDateUnitCost: number;
  currentUnitCost: number;
  saleDateExtendedCost: number;
  currentExtendedCost: number;
  variance: number;
};

export type OrderFinancialSummaryRow = {
  orderId: string;
  cogs: number;
  netSales: number;
  grossProfit: number;
};

export function createTrendBuckets(range: ReportRange, start: Date, end: Date): Bucket[] {
  if (range === 'day') {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: String(hour),
      label: `${String(hour).padStart(2, '0')}:00`,
      revenue: 0,
      netSales: 0,
      cogs: 0,
      ingredientSpend: 0,
      grossProfit: 0,
      orders: 0,
    }));
  }

  return eachDayOfInterval({ start, end }).map((date) => ({
    key: format(date, 'yyyy-MM-dd'),
    label: range === 'month' ? format(date, 'MMM d') : format(date, 'EEE'),
    revenue: 0,
    netSales: 0,
    cogs: 0,
    ingredientSpend: 0,
    grossProfit: 0,
    orders: 0,
  }));
}

export function getBucketKeyForDate(range: ReportRange, date: Date) {
  return range === 'day' ? String(date.getHours()) : format(date, 'yyyy-MM-dd');
}

function getPurchasesInRange(purchases: AnalyticsPurchase[], start: Date, end: Date) {
  return purchases.filter((purchase) => purchase.purchasedAt >= start && purchase.purchasedAt <= end);
}

export function buildPurchaseAnalytics(purchases: AnalyticsPurchase[], inventory: AnalyticsInventory[]): PurchaseAnalytics {
  const purchasesInRange = purchases;
  const totalSpend = sumBy(purchasesInRange, (purchase) => purchase.totalCost || 0);
  const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

  const ingredientMap = new Map<string, PurchaseBreakdownRow & { suppliers: Set<string> }>();
  const supplierMap = new Map<string, SupplierSpendRow>();

  for (const purchase of purchasesInRange) {
    const inventoryRow = purchase.inventory ?? inventoryMap.get(purchase.inventoryId);
    const existingIngredient = ingredientMap.get(purchase.inventoryId) ?? {
      inventoryId: purchase.inventoryId,
      name: inventoryRow?.name || 'Unknown ingredient',
      category: inventoryRow?.category || 'Uncategorised',
      unit: inventoryRow?.unit || '',
      quantity: 0,
      totalCost: 0,
      purchaseCount: 0,
      averageUnitCost: 0,
      supplierCount: 0,
      lastPurchasedAt: null,
      spendSharePct: 0,
      suppliers: new Set<string>(),
    };

    existingIngredient.quantity += purchase.quantity;
    existingIngredient.totalCost += purchase.totalCost;
    existingIngredient.purchaseCount += 1;
    existingIngredient.averageUnitCost = existingIngredient.quantity > 0
      ? existingIngredient.totalCost / existingIngredient.quantity
      : 0;
    existingIngredient.lastPurchasedAt = purchase.purchasedAt.toISOString();
    if (purchase.supplier) {
      existingIngredient.suppliers.add(purchase.supplier);
      existingIngredient.supplierCount = existingIngredient.suppliers.size;
    }
    ingredientMap.set(purchase.inventoryId, existingIngredient);

    const supplierKey = purchase.supplier || 'Unspecified supplier';
    const existingSupplier = supplierMap.get(supplierKey) ?? {
      supplier: supplierKey,
      totalCost: 0,
      purchaseCount: 0,
      sharePct: 0,
    };
    existingSupplier.totalCost += purchase.totalCost;
    existingSupplier.purchaseCount += 1;
    supplierMap.set(supplierKey, existingSupplier);
  }

  const purchasesByIngredient = [...ingredientMap.values()]
    .map(({ suppliers, ...row }) => ({
      ...row,
      supplierCount: suppliers.size,
      spendSharePct: totalSpend > 0 ? (row.totalCost / totalSpend) * 100 : 0,
    }))
    .sort((left, right) => right.totalCost - left.totalCost);

  const supplierSpend = [...supplierMap.values()]
    .map((row) => ({
      ...row,
      sharePct: totalSpend > 0 ? (row.totalCost / totalSpend) * 100 : 0,
    }))
    .sort((left, right) => right.totalCost - left.totalCost);

  const recentPurchases: RecentPurchaseRow[] = [...purchasesInRange]
    .sort((left, right) => right.purchasedAt.getTime() - left.purchasedAt.getTime())
    .slice(0, 20)
    .map((purchase) => {
      const inventoryRow = purchase.inventory ?? inventoryMap.get(purchase.inventoryId);
      return {
        inventoryId: purchase.inventoryId,
        inventoryName: inventoryRow?.name || 'Unknown ingredient',
        category: inventoryRow?.category || 'Uncategorised',
        unit: inventoryRow?.unit || '',
        quantity: purchase.quantity,
        unitCost: purchase.unitCost,
        totalCost: purchase.totalCost,
        supplier: purchase.supplier || null,
        notes: purchase.notes || null,
        purchasedAt: purchase.purchasedAt.toISOString(),
      };
    });

  const topPurchasedIngredients = purchasesByIngredient.slice(0, 5);
  const spendConcentrationPct = topPurchasedIngredients.reduce((sum, item) => sum + item.spendSharePct, 0);

  return {
    totalSpend,
    purchasesByIngredient,
    supplierSpend,
    recentPurchases,
    topPurchasedIngredients,
    spendConcentrationPct,
  };
}

export function buildPeriodComparisonSummary(params: {
  range: Exclude<ReportRange, 'custom'>;
  label: string;
  shortLabel: string;
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  inventory: AnalyticsInventory[];
  start: Date;
  end: Date;
  costMethod?: CostMethod;
}): PeriodComparisonSummary {
  const analytics = buildFinancialAnalytics({
    range: params.range,
    start: params.start,
    end: params.end,
    orders: params.orders,
    purchases: params.purchases,
    inventory: params.inventory,
    costMethod: params.costMethod,
  });
  const topPurchasedIngredient = analytics.purchaseAnalytics.topPurchasedIngredients[0];

  return {
    range: params.range,
    label: params.label,
    shortLabel: params.shortLabel,
    netSales: analytics.summary.netSales,
    ingredientSpend: analytics.summary.ingredientSpend,
    grossProfit: analytics.summary.grossProfit,
    grossMarginPct: analytics.summary.grossMarginPct,
    totalOrders: analytics.summary.paidOrdersCount,
    topPurchasedIngredient: topPurchasedIngredient?.name || 'No purchases yet',
    topPurchasedIngredientSpend: topPurchasedIngredient?.totalCost || 0,
    spendConcentrationPct: analytics.purchaseAnalytics.spendConcentrationPct,
  };
}

function buildDelta(current: number, previous: number) {
  return {
    current,
    previous,
    delta: current - previous,
    deltaPct: previous !== 0 ? ((current - previous) / previous) * 100 : null,
  };
}

export function buildPreviousPeriodComparison(params: {
  currentLabel: string;
  previousLabel: string;
  current: {
    summary: {
      netSales: number;
      ingredientSpend: number;
      grossProfit: number;
      grossMarginPct: number;
      paidOrdersCount: number;
    };
  };
  previous: {
    summary: {
      netSales: number;
      ingredientSpend: number;
      grossProfit: number;
      grossMarginPct: number;
      paidOrdersCount: number;
    };
  };
}): PreviousPeriodComparison {
  return {
    currentLabel: params.currentLabel,
    previousLabel: params.previousLabel,
    metrics: {
      netSales: buildDelta(params.current.summary.netSales, params.previous.summary.netSales),
      ingredientSpend: buildDelta(params.current.summary.ingredientSpend, params.previous.summary.ingredientSpend),
      grossProfit: buildDelta(params.current.summary.grossProfit, params.previous.summary.grossProfit),
      grossMarginPct: buildDelta(params.current.summary.grossMarginPct, params.previous.summary.grossMarginPct),
      totalOrders: buildDelta(params.current.summary.paidOrdersCount, params.previous.summary.paidOrdersCount),
    },
  };
}

export function buildPurchaseHistoryRows(
  purchases: AnalyticsPurchase[],
  inventory: AnalyticsInventory[],
  resolution: 'day' | 'week'
): PurchaseHistoryRow[] {
  const inventoryMap = new Map(inventory.map((item) => [item.id, item]));
  const bucketMap = new Map<string, PurchaseHistoryRow & { ingredientTotals: Map<string, number>; supplierTotals: Map<string, number> }>();

  for (const purchase of purchases) {
    const bucketDate = resolution === 'week' ? startOfWeek(purchase.purchasedAt) : purchase.purchasedAt;
    const key = resolution === 'week' ? format(bucketDate, 'yyyy-MM-dd') : format(purchase.purchasedAt, 'yyyy-MM-dd');
    const label = resolution === 'week'
      ? `${format(bucketDate, 'MMM d')} - ${format(endOfWeek(purchase.purchasedAt), 'MMM d')}`
      : format(purchase.purchasedAt, 'EEE, MMM d');

    const row = bucketMap.get(key) ?? {
      key,
      label,
      totalSpend: 0,
      purchaseCount: 0,
      topIngredient: 'No purchases yet',
      topSupplier: 'Unspecified supplier',
      ingredientTotals: new Map<string, number>(),
      supplierTotals: new Map<string, number>(),
    };

    const ingredientName = purchase.inventory?.name || inventoryMap.get(purchase.inventoryId)?.name || 'Unknown ingredient';
    const supplierName = purchase.supplier || 'Unspecified supplier';

    row.totalSpend += purchase.totalCost;
    row.purchaseCount += 1;
    row.ingredientTotals.set(ingredientName, (row.ingredientTotals.get(ingredientName) || 0) + purchase.totalCost);
    row.supplierTotals.set(supplierName, (row.supplierTotals.get(supplierName) || 0) + purchase.totalCost);
    bucketMap.set(key, row);
  }

  return [...bucketMap.values()]
    .map(({ ingredientTotals, supplierTotals, ...row }) => {
      const topIngredient = [...ingredientTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'No purchases yet';
      const topSupplier = [...supplierTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unspecified supplier';
      return { ...row, topIngredient, topSupplier };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function buildCostAuditRows(params: {
  orders: Array<AnalyticsOrder & { orderNumber?: number }>;
  purchases: AnalyticsPurchase[];
  inventory: AnalyticsInventory[];
}): CostAuditRow[] {
  const currentCostMap = buildInventoryCostMap(params.purchases, params.inventory);
  const inventoryMap = new Map(params.inventory.map((item) => [item.id, item]));
  const rows: CostAuditRow[] = [];

  for (const order of params.orders) {
    const saleDateCostMap = buildInventoryCostMap(params.purchases, params.inventory, order.createdAt);
    for (const item of order.items) {
      const usage = buildOrderItemIngredientUsage(item);
      for (const [inventoryId, quantityUsed] of usage.entries()) {
        if (quantityUsed <= 0) continue;
        const inventoryItem = inventoryMap.get(inventoryId);
        const saleDateUnitCost = saleDateCostMap.get(inventoryId)?.weightedAverageCost ?? 0;
        const currentUnitCost = currentCostMap.get(inventoryId)?.weightedAverageCost ?? 0;
        rows.push({
          orderId: order.id,
          orderNumber: order.orderNumber ?? 0,
          soldAt: order.createdAt.toISOString(),
          itemName: item.menuItem.name,
          ingredientName: inventoryItem?.name || 'Unknown ingredient',
          ingredientUnit: inventoryItem?.unit || '',
          quantityUsed,
          saleDateUnitCost,
          currentUnitCost,
          saleDateExtendedCost: quantityUsed * saleDateUnitCost,
          currentExtendedCost: quantityUsed * currentUnitCost,
          variance: (quantityUsed * currentUnitCost) - (quantityUsed * saleDateUnitCost),
        });
      }
    }
  }

  return rows
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 25);
}

export function buildOrderFinancialSummaryMap(params: {
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  inventory: AnalyticsInventory[];
  costMethod?: CostMethod;
}) {
  const costMethod = params.costMethod ?? 'weighted_average_as_of_sale_date';
  const sortedOrders = [...params.orders]
    .filter((order) => isRecognizedRevenueOrder(order) && order.status !== 'cancelled')
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const costMapCache = new Map<string, ReturnType<typeof buildInventoryCostMap>>();
  const fallbackCostMap = new Map(params.inventory.map((item) => [item.id, item.cost ?? 0]));
  const sortedPurchases = [...params.purchases].sort((left, right) => left.purchasedAt.getTime() - right.purchasedAt.getTime());
  const inventoryLayers = new Map<string, InventoryLayer[]>();
  let purchaseCursor = 0;

  const getCostMapForDate = (date: Date) => {
    const cacheKey = date.toISOString().slice(0, 10);
    const existing = costMapCache.get(cacheKey);
    if (existing) {
      return existing;
    }
    const costMap = buildInventoryCostMap(params.purchases, params.inventory, date);
    costMapCache.set(cacheKey, costMap);
    return costMap;
  };

  const addPurchasesThrough = (date: Date) => {
    while (purchaseCursor < sortedPurchases.length && sortedPurchases[purchaseCursor].purchasedAt <= date) {
      const purchase = sortedPurchases[purchaseCursor];
      const layers = inventoryLayers.get(purchase.inventoryId) ?? [];
      layers.push({
        remainingQuantity: purchase.quantity,
        unitCost: purchase.unitCost,
      });
      inventoryLayers.set(purchase.inventoryId, layers);
      purchaseCursor += 1;
    }
  };

  const consumeLayeredCost = (inventoryId: string, quantityNeeded: number) => {
    const fallbackCost = fallbackCostMap.get(inventoryId) ?? 0;
    const layers = inventoryLayers.get(inventoryId) ?? [];
    let remaining = quantityNeeded;
    let totalCost = 0;

    while (remaining > 0 && layers.length > 0) {
      const layerIndex = costMethod === 'lifo' ? layers.length - 1 : 0;
      const layer = layers[layerIndex];
      const consumed = Math.min(remaining, layer.remainingQuantity);
      totalCost += consumed * layer.unitCost;
      layer.remainingQuantity -= consumed;
      remaining -= consumed;

      if (layer.remainingQuantity <= 0) {
        layers.splice(layerIndex, 1);
      }
    }

    if (remaining > 0) {
      totalCost += remaining * fallbackCost;
    }

    inventoryLayers.set(inventoryId, layers);
    return totalCost;
  };

  const summaryMap = new Map<string, OrderFinancialSummaryRow>();

  for (const order of sortedOrders) {
    let cogs = 0;

    for (const item of order.items) {
      if (costMethod === 'weighted_average_as_of_sale_date') {
        cogs += calculateOrderItemProfitability(item, getCostMapForDate(order.createdAt)).estimatedCost;
        continue;
      }

      addPurchasesThrough(order.createdAt);
      const ingredientUsage = buildOrderItemIngredientUsage(item);
      for (const [inventoryId, quantityUsed] of ingredientUsage.entries()) {
        if (quantityUsed <= 0) continue;
        cogs += consumeLayeredCost(inventoryId, quantityUsed);
      }
    }

    const netSales = order.subtotal - order.discount;
    summaryMap.set(order.id, {
      orderId: order.id,
      cogs,
      netSales,
      grossProfit: netSales - cogs,
    });
  }

  return summaryMap;
}

export function buildFinancialAnalytics(params: {
  range: ReportRange;
  start: Date;
  end: Date;
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  inventory: AnalyticsInventory[];
  costMethod?: CostMethod;
}) {
  const costMethod = params.costMethod ?? 'weighted_average_as_of_sale_date';
  const ordersInRange = params.orders.filter((order) => order.createdAt >= params.start && order.createdAt <= params.end);
  const paidOrders = ordersInRange.filter((order) => isRecognizedRevenueOrder(order) && order.status !== 'cancelled');
  const buckets = createTrendBuckets(params.range, params.start, params.end);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const itemMap = new Map<string, OrderItemProfitability>();
  const costMapCache = new Map<string, ReturnType<typeof buildInventoryCostMap>>();
  const fallbackCostMap = new Map(params.inventory.map((item) => [item.id, item.cost ?? 0]));
  const sortedPurchases = [...params.purchases].sort((left, right) => left.purchasedAt.getTime() - right.purchasedAt.getTime());
  const inventoryLayers = new Map<string, InventoryLayer[]>();
  let purchaseCursor = 0;

  const getCostMapForDate = (date: Date) => {
    const cacheKey = date.toISOString().slice(0, 10);
    const existing = costMapCache.get(cacheKey);
    if (existing) {
      return existing;
    }
    const costMap = buildInventoryCostMap(params.purchases, params.inventory, date);
    costMapCache.set(cacheKey, costMap);
    return costMap;
  };

  const addPurchasesThrough = (date: Date) => {
    while (purchaseCursor < sortedPurchases.length && sortedPurchases[purchaseCursor].purchasedAt <= date) {
      const purchase = sortedPurchases[purchaseCursor];
      const layers = inventoryLayers.get(purchase.inventoryId) ?? [];
      layers.push({
        remainingQuantity: purchase.quantity,
        unitCost: purchase.unitCost,
      });
      inventoryLayers.set(purchase.inventoryId, layers);
      purchaseCursor += 1;
    }
  };

  const consumeLayeredCost = (inventoryId: string, quantityNeeded: number) => {
    const fallbackCost = fallbackCostMap.get(inventoryId) ?? 0;
    const layers = inventoryLayers.get(inventoryId) ?? [];
    let remaining = quantityNeeded;
    let totalCost = 0;

    while (remaining > 0 && layers.length > 0) {
      const layerIndex = costMethod === 'lifo' ? layers.length - 1 : 0;
      const layer = layers[layerIndex];
      const consumed = Math.min(remaining, layer.remainingQuantity);
      totalCost += consumed * layer.unitCost;
      layer.remainingQuantity -= consumed;
      remaining -= consumed;

      if (layer.remainingQuantity <= 0) {
        layers.splice(layerIndex, 1);
      }
    }

    if (remaining > 0) {
      totalCost += remaining * fallbackCost;
    }

    inventoryLayers.set(inventoryId, layers);
    return totalCost;
  };

  const calculateItemCost = (item: AnalyticsOrder['items'][number], orderDate: Date) => {
    if (costMethod === 'weighted_average_as_of_sale_date') {
      return calculateOrderItemProfitability(item, getCostMapForDate(orderDate));
    }

    addPurchasesThrough(orderDate);
    const ingredientUsage = buildOrderItemIngredientUsage(item);
    let estimatedCost = 0;

    for (const [inventoryId, quantityUsed] of ingredientUsage.entries()) {
      if (quantityUsed <= 0) continue;
      estimatedCost += consumeLayeredCost(inventoryId, quantityUsed);
    }

    const revenue = item.quantity * item.unitPrice;
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
  };

  for (const order of paidOrders) {
    const bucket = bucketMap.get(getBucketKeyForDate(params.range, order.createdAt));
    const netSales = order.subtotal - order.discount;
    let orderCogs = 0;

    for (const item of order.items) {
      const itemFinancials = calculateItemCost(item, order.createdAt);
      orderCogs += itemFinancials.estimatedCost;

      const existing = itemMap.get(item.menuItemId);
      if (existing) {
        existing.quantity += itemFinancials.quantity;
        existing.revenue += itemFinancials.revenue;
        existing.estimatedCost += itemFinancials.estimatedCost;
        existing.grossProfit += itemFinancials.grossProfit;
        existing.grossMarginPct = existing.revenue > 0 ? (existing.grossProfit / existing.revenue) * 100 : 0;
      } else {
        itemMap.set(item.menuItemId, { ...itemFinancials });
      }
    }

    if (bucket) {
      bucket.revenue += order.total;
      bucket.netSales += netSales;
      bucket.cogs += orderCogs;
      bucket.grossProfit += netSales - orderCogs;
      bucket.orders += 1;
    }
  }

  const purchasesInRange = getPurchasesInRange(params.purchases, params.start, params.end);
  for (const purchase of purchasesInRange) {
    const bucket = bucketMap.get(getBucketKeyForDate(params.range, purchase.purchasedAt));
    if (bucket) {
      bucket.ingredientSpend += purchase.totalCost;
    }
  }

  const itemProfitability = [...itemMap.values()]
    .sort((left, right) => right.grossProfit - left.grossProfit);

  const summary = {
    recognizedRevenue: sumBy(paidOrders, (order) => order.total || 0),
    netSales: sumBy(paidOrders, (order) => order.subtotal - order.discount),
    taxCollected: sumBy(paidOrders, (order) => order.tax || 0),
    discountsGiven: sumBy(paidOrders, (order) => order.discount || 0),
    ingredientSpend: sumBy(purchasesInRange, (purchase) => purchase.totalCost || 0),
    cogs: sumBy(itemProfitability, (item) => item.estimatedCost),
    grossProfit: sumBy(itemProfitability, (item) => item.grossProfit),
    grossMarginPct: 0,
    avgTicket: paidOrders.length > 0 ? sumBy(paidOrders, (order) => order.total || 0) / paidOrders.length : 0,
    paidOrdersCount: paidOrders.length,
  };

  summary.grossMarginPct = summary.netSales > 0 ? (summary.grossProfit / summary.netSales) * 100 : 0;

  const topItems = [...itemProfitability]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
  const slowMovingItems = [...itemProfitability]
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.quantity - right.quantity)
    .slice(0, 5);
  const highMarginItems = [...itemProfitability]
    .filter((item) => item.revenue > 0)
    .sort((left, right) => right.grossMarginPct - left.grossMarginPct)
    .slice(0, 5);
  const lowMarginItems = [...itemProfitability]
    .filter((item) => item.revenue > 0)
    .sort((left, right) => left.grossMarginPct - right.grossMarginPct)
    .slice(0, 5);

  const salesVelocity = [...itemProfitability]
    .sort((left, right) => right.quantity - left.quantity)
    .map((item) => ({
      ...item,
      unitsPerDay: params.range === 'day'
        ? item.quantity
        : item.quantity / Math.max(1, buckets.length),
    }));

  const purchaseAnalytics = buildPurchaseAnalytics(purchasesInRange, params.inventory);

  return {
    metadata: {
      costMethod,
      supportedCostMethods: ['weighted_average_as_of_sale_date', 'fifo', 'lifo'],
    },
    summary,
    trend: buckets,
    itemProfitability,
    topItems,
    slowMovingItems,
    highMarginItems,
    lowMarginItems,
    salesVelocity,
    purchaseAnalytics,
  };
}
