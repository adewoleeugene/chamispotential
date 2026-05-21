export const WAITER_ROLES = ['waiter', 'cashier', 'staff'] as const;
export type WaiterRole = typeof WAITER_ROLES[number];

export function isWaiterRole(role: string | null | undefined): boolean {
    return role === 'waiter' || role === 'cashier' || role === 'staff';
}

export function getDefaultRouteForRole(role?: string | null) {
    if (role === 'kitchen') return '/kitchen';
    if (isWaiterRole(role)) return '/tables';
    return '/dashboard';
}
