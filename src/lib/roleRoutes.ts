export function getDefaultRouteForRole(role?: string | null) {
    if (role === 'kitchen') return '/kitchen';
    if (role === 'waiter') return '/tables';
    return '/dashboard';
}
