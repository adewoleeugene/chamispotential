/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..', '..');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithAlias(request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith('@/')) {
    const absoluteRequest = path.join(projectRoot, 'src', request.slice(2));
    return originalResolveFilename.call(this, absoluteRequest, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { buildPurchaseLedgerRows } = require('../../src/lib/purchase-ledger');
const {
  buildCostAuditRows,
  buildFinancialAnalytics,
  buildPeriodComparisonSummary,
  buildPreviousPeriodComparison,
  buildPurchaseHistoryRows,
  buildPurchaseAnalytics,
} = require('../../src/lib/restaurant-analytics');
const { getPreviousPeriodRange, getReportRange } = require('../../src/lib/reporting');

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const inventory = [
  { id: 'rice', cost: 2, name: 'Rice', unit: 'kg', category: 'Dry Goods' },
  { id: 'fish', cost: 5, name: 'Fish', unit: 'kg', category: 'Protein' },
];

const purchases = [
  {
    inventoryId: 'rice',
    quantity: 10,
    unitCost: 2,
    totalCost: 20,
    purchasedAt: new Date('2026-03-01T08:00:00.000Z'),
    inventory: { id: 'rice', name: 'Rice', unit: 'kg', category: 'Dry Goods' },
    supplier: 'Makola Foods',
    notes: 'Opening stock',
  },
  {
    inventoryId: 'rice',
    quantity: 10,
    unitCost: 4,
    totalCost: 40,
    purchasedAt: new Date('2026-03-10T08:00:00.000Z'),
    inventory: { id: 'rice', name: 'Rice', unit: 'kg', category: 'Dry Goods' },
    supplier: 'Makola Foods',
    notes: 'Price increase',
  },
  {
    inventoryId: 'fish',
    quantity: 5,
    unitCost: 6,
    totalCost: 30,
    purchasedAt: new Date('2026-03-12T08:00:00.000Z'),
    inventory: { id: 'fish', name: 'Fish', unit: 'kg', category: 'Protein' },
    supplier: 'Ocean Catch',
    notes: null,
  },
];

const orders = [
  {
    id: 'order-early',
    status: 'completed',
    paymentStatus: 'paid',
    type: 'dine-in',
    subtotal: 40,
    discount: 0,
    tax: 4,
    total: 44,
    createdAt: new Date('2026-03-05T12:00:00.000Z'),
    items: [
      {
        id: 'item-early',
        menuItemId: 'menu-1',
        quantity: 2,
        unitPrice: 20,
        menuItem: {
          id: 'menu-1',
          name: 'Jollof Bowl',
          category: { name: 'Mains' },
          recipeIngredients: [
            { inventoryId: 'rice', quantityUsed: 1 },
          ],
        },
        removals: [],
        additions: [],
      },
    ],
  },
  {
    id: 'order-late',
    status: 'completed',
    paymentStatus: 'paid',
    type: 'takeout',
    subtotal: 25,
    discount: 5,
    tax: 2,
    total: 27,
    createdAt: new Date('2026-03-15T12:00:00.000Z'),
    items: [
      {
        id: 'item-late',
        menuItemId: 'menu-1',
        quantity: 1,
        unitPrice: 25,
        menuItem: {
          id: 'menu-1',
          name: 'Jollof Bowl',
          category: { name: 'Mains' },
          recipeIngredients: [
            { inventoryId: 'rice', quantityUsed: 1 },
            { inventoryId: 'fish', quantityUsed: 0.5 },
          ],
        },
        removals: [],
        additions: [],
      },
    ],
  },
];

test('buildFinancialAnalytics applies weighted-average cost as of the sale date', () => {
  const analytics = buildFinancialAnalytics({
    range: 'month',
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.999Z'),
    orders,
    purchases,
    inventory,
  });

  assert.equal(analytics.metadata.costMethod, 'weighted_average_as_of_sale_date');
  assert.equal(Number(analytics.summary.cogs.toFixed(2)), 10);
  assert.equal(Number(analytics.summary.grossProfit.toFixed(2)), 55);
  assert.equal(Number(analytics.highMarginItems[0].grossMarginPct.toFixed(2)), 84.62);
});

test('buildFinancialAnalytics supports fifo and lifo costing methods', () => {
  const fifoAnalytics = buildFinancialAnalytics({
    range: 'month',
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.999Z'),
    orders,
    purchases,
    inventory,
    costMethod: 'fifo',
  });
  const lifoAnalytics = buildFinancialAnalytics({
    range: 'month',
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.999Z'),
    orders,
    purchases,
    inventory,
    costMethod: 'lifo',
  });

  assert.equal(fifoAnalytics.metadata.costMethod, 'fifo');
  assert.equal(lifoAnalytics.metadata.costMethod, 'lifo');
  assert.equal(Number(fifoAnalytics.summary.cogs.toFixed(2)), 9);
  assert.equal(Number(lifoAnalytics.summary.cogs.toFixed(2)), 11);
});

test('buildPurchaseAnalytics groups ingredient and supplier spend for reports', () => {
  const analytics = buildPurchaseAnalytics(purchases, inventory);

  assert.equal(Number(analytics.totalSpend.toFixed(2)), 90);
  assert.equal(analytics.purchasesByIngredient[0].name, 'Rice');
  assert.equal(Number(analytics.purchasesByIngredient[0].totalCost.toFixed(2)), 60);
  assert.equal(analytics.supplierSpend[0].supplier, 'Makola Foods');
  assert.equal(Number(analytics.spendConcentrationPct.toFixed(2)), 100);
});

test('buildPeriodComparisonSummary returns manager-friendly purchase comparison metrics', () => {
  const comparison = buildPeriodComparisonSummary({
    range: 'month',
    label: 'This Month',
    shortLabel: 'Month',
    orders,
    purchases,
    inventory,
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.999Z'),
  });

  assert.equal(comparison.label, 'This Month');
  assert.equal(comparison.topPurchasedIngredient, 'Rice');
  assert.equal(Number(comparison.topPurchasedIngredientSpend.toFixed(2)), 60);
  assert.equal(Number(comparison.ingredientSpend.toFixed(2)), 90);
});

test('buildPurchaseLedgerRows formats CSV-ready purchase ledger entries', () => {
  const rows = buildPurchaseLedgerRows([
    {
      id: 'purchase-1',
      inventoryId: 'rice',
      inventoryName: 'Rice',
      category: 'Dry Goods',
      unit: 'kg',
      quantity: 12.5,
      unitCost: 3.4,
      totalCost: 42.5,
      supplier: 'Makola Foods',
      notes: 'Weekly top-up',
      purchasedAt: new Date('2026-03-18T09:30:00.000Z'),
      createdAt: new Date('2026-03-18T10:00:00.000Z'),
    },
  ]);

  assert.deepEqual(rows[0], [
    'purchase-1',
    'rice',
    'Rice',
    'Dry Goods',
    'kg',
    '12.50',
    '3.40',
    '42.50',
    'Makola Foods',
    'Weekly top-up',
    '2026-03-18T09:30:00.000Z',
    '2026-03-18T10:00:00.000Z',
  ]);
});

test('getReportRange supports custom date ranges and previous period calculation', () => {
  const range = getReportRange('custom', new Date('2026-03-24T09:00:00.000Z'), '2026-03-10', '2026-03-20');
  const previous = getPreviousPeriodRange(range);

  assert.equal(range.range, 'custom');
  assert.equal(range.start.toISOString(), '2026-03-10T00:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-03-20T23:59:59.999Z');
  assert.equal(previous.start.toISOString(), '2026-02-27T00:00:00.000Z');
  assert.equal(previous.end.toISOString(), '2026-03-09T23:59:59.999Z');
});

test('buildPreviousPeriodComparison computes deltas for report cards', () => {
  const current = buildFinancialAnalytics({
    range: 'week',
    start: new Date('2026-03-10T00:00:00.000Z'),
    end: new Date('2026-03-20T23:59:59.999Z'),
    orders,
    purchases,
    inventory,
  });
  const previous = buildFinancialAnalytics({
    range: 'week',
    start: new Date('2026-03-01T00:00:00.000Z'),
    end: new Date('2026-03-09T23:59:59.999Z'),
    orders,
    purchases,
    inventory,
  });
  const comparison = buildPreviousPeriodComparison({
    currentLabel: 'Current',
    previousLabel: 'Previous',
    current,
    previous,
  });

  assert.equal(comparison.metrics.netSales.current, 20);
  assert.equal(comparison.metrics.netSales.previous, 40);
  assert.equal(comparison.metrics.netSales.delta, -20);
});

test('buildPurchaseHistoryRows and buildCostAuditRows support drilldown sections', () => {
  const history = buildPurchaseHistoryRows(purchases, inventory, 'week');
  const audit = buildCostAuditRows({
    orders: orders.map((order, index) => ({ ...order, orderNumber: index + 1 })),
    purchases,
    inventory,
  });

  assert.equal(history[0].topIngredient.length > 0, true);
  assert.equal(history[0].topSupplier.length > 0, true);
  assert.equal(audit.length > 0, true);
  assert.equal(audit[0].ingredientName.length > 0, true);
});

console.log('All reporting tests passed.');
