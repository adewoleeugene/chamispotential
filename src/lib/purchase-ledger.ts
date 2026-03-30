export type PurchaseLedgerEntry = {
  id: string;
  inventoryId: string;
  inventoryName: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string | null;
  notes: string | null;
  purchasedAt: Date;
  createdAt?: Date | null;
};

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : '';
}

export function buildPurchaseLedgerRows(purchases: PurchaseLedgerEntry[]) {
  return purchases.map((purchase) => [
    purchase.id,
    purchase.inventoryId,
    purchase.inventoryName,
    purchase.category,
    purchase.unit,
    purchase.quantity.toFixed(2),
    purchase.unitCost.toFixed(2),
    purchase.totalCost.toFixed(2),
    purchase.supplier ?? '',
    purchase.notes ?? '',
    formatDate(purchase.purchasedAt),
    formatDate(purchase.createdAt),
  ]);
}
