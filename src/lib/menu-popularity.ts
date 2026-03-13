export const POPULARITY_LOOKBACK_DAYS = 30;
const POPULARITY_MIN_ORDERS = 3;

export type MenuOrderLine = {
    menuItemId: string;
    quantity: number;
};

export function summarizeMenuPopularity(orderLines: MenuOrderLine[]) {
    const quantityByMenuItemId = new Map<string, number>();

    for (const line of orderLines) {
        quantityByMenuItemId.set(
            line.menuItemId,
            (quantityByMenuItemId.get(line.menuItemId) || 0) + line.quantity
        );
    }

    const rankedQuantities = [...quantityByMenuItemId.values()]
        .filter((quantity) => quantity > 0)
        .sort((left, right) => right - left);

    if (rankedQuantities.length === 0) {
        return {
            quantityByMenuItemId,
            popularIds: new Set<string>(),
            popularityThreshold: POPULARITY_MIN_ORDERS,
        };
    }

    const popularBucketSize = Math.max(1, Math.ceil(rankedQuantities.length / 3));
    const popularityThreshold = Math.max(
        POPULARITY_MIN_ORDERS,
        rankedQuantities[popularBucketSize - 1] || 0
    );

    const popularIds = new Set(
        [...quantityByMenuItemId.entries()]
            .filter(([, quantity]) => quantity >= popularityThreshold)
            .map(([menuItemId]) => menuItemId)
    );

    return {
        quantityByMenuItemId,
        popularIds,
        popularityThreshold,
    };
}
