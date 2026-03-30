export const TABLE_STATUS_COLORS = {
    available: {
        solid: '#10b981',
        tint: 'rgba(16,185,129,0.15)',
        panel: 'rgba(16,185,129,0.1)',
    },
    occupied: {
        solid: '#ef4444',
        tint: 'rgba(239,68,68,0.15)',
        panel: 'rgba(239,68,68,0.1)',
    },
    reserved: {
        solid: '#94a3b8',
        tint: 'rgba(148,163,184,0.16)',
        panel: 'rgba(148,163,184,0.16)',
    },
    cleaning: {
        solid: '#a855f7',
        tint: 'rgba(168,85,247,0.15)',
        panel: 'rgba(168,85,247,0.15)',
    },
} as const;

export type TableDisplayStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';

export function getTableStatusColor(status?: string) {
    if (status === 'occupied') return TABLE_STATUS_COLORS.occupied;
    if (status === 'reserved') return TABLE_STATUS_COLORS.reserved;
    if (status === 'cleaning') return TABLE_STATUS_COLORS.cleaning;
    return TABLE_STATUS_COLORS.available;
}

export function getTableDisplayStatus({
    status,
    activeOrderCount = 0,
}: {
    status?: string | null;
    activeOrderCount?: number;
}): TableDisplayStatus {
    if (activeOrderCount > 0) return 'occupied';
    if (status === 'reserved') return 'reserved';
    if (status === 'cleaning') return 'cleaning';
    return 'available';
}
