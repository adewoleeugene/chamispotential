export type OrderItemRemovalInput = {
  recipeIngredientId: string;
};

export type OrderItemAdditionInput = {
  menuItemExtraOptionId: string;
};

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  kitchenNote?: string;
  removals?: OrderItemRemovalInput[];
  additions?: OrderItemAdditionInput[];
};

export type CustomizationOptionResponse = {
  menuItemId: string;
  name: string;
  removableParts: Array<{
    recipeIngredientId: string;
    inventoryId: string;
    label: string;
    quantityUsed: number;
    unit: string;
  }>;
  addableExtras: Array<{
    menuItemExtraOptionId: string;
    inventoryId: string;
    label: string;
    quantityUsed: number;
    unit: string;
  }>;
};

export function normalizeCustomizationInputs(input: OrderItemInput): OrderItemInput {
  const removals = Array.isArray(input.removals)
    ? input.removals
      .map((item) => ({
        recipeIngredientId: String(item?.recipeIngredientId ?? '').trim(),
      }))
      .filter((item) => item.recipeIngredientId)
    : [];

  const additions = Array.isArray(input.additions)
    ? input.additions
      .map((item) => ({
        menuItemExtraOptionId: String(item?.menuItemExtraOptionId ?? '').trim(),
      }))
      .filter((item) => item.menuItemExtraOptionId)
    : [];

  return {
    ...input,
    menuItemId: String(input.menuItemId ?? '').trim(),
    quantity: Number(input.quantity),
    notes: String(input.notes ?? '').trim() || undefined,
    kitchenNote: String(input.kitchenNote ?? '').trim() || undefined,
    removals,
    additions,
  };
}

export function hasDuplicateValues(values: string[]) {
  return new Set(values).size !== values.length;
}
