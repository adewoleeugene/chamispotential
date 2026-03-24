import { NextRequest, NextResponse } from 'next/server';
import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { isRecognizedRevenueOrder } from '@/lib/revenue';
import { getTableDisplayStatus } from '@/lib/table-status';

type AnalyticsRange = 'day' | 'week' | 'month';

function getRangeConfig(range: string | null) {
    const normalized: AnalyticsRange = range === 'day' || range === 'month' ? range : 'week';
    const now = new Date();

    if (normalized === 'day') {
        return {
            range: normalized,
            label: 'Today',
            start: startOfDay(now),
            end: endOfDay(now),
        };
    }

    if (normalized === 'month') {
        return {
            range: normalized,
            label: 'This Month',
            start: startOfMonth(now),
            end: endOfMonth(now),
        };
    }

    return {
        range: normalized,
        label: 'This Week',
        start: startOfWeek(now),
        end: endOfWeek(now),
    };
}

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const config = getRangeConfig(url.searchParams.get('range'));
    const previousStart = subDays(config.start, config.range === 'month' ? 30 : config.range === 'week' ? 7 : 1);

    const [tables, currentOrders, periodOrders, previousOrders] = await Promise.all([
        prisma.table.findMany({
            select: {
                id: true,
                number: true,
                section: true,
                status: true,
            },
            orderBy: { number: 'asc' },
        }),
        prisma.order.findMany({
            where: {
                tableId: { not: null },
                status: { in: ['pending', 'preparing', 'ready', 'served'] },
            },
            select: {
                id: true,
                tableId: true,
                total: true,
                status: true,
            },
        }),
        prisma.order.findMany({
            where: {
                tableId: { not: null },
                createdAt: { gte: config.start, lte: config.end },
                status: { not: 'cancelled' },
            },
            select: {
                id: true,
                tableId: true,
                total: true,
                status: true,
                paymentStatus: true,
                type: true,
                createdAt: true,
            },
        }),
        prisma.order.findMany({
            where: {
                tableId: { not: null },
                createdAt: { gte: previousStart, lt: config.start },
                status: { not: 'cancelled' },
            },
            select: {
                id: true,
                tableId: true,
                total: true,
                status: true,
                paymentStatus: true,
            },
        }),
    ]);

    const currentOrderCountByTable = currentOrders.reduce<Record<string, number>>((acc, order) => {
        if (!order.tableId) return acc;
        acc[order.tableId] = (acc[order.tableId] || 0) + 1;
        return acc;
    }, {});

    const periodStatsByTable = periodOrders.reduce<Record<string, {
        revenue: number;
        ordersCount: number;
        lastOrderAt: string | null;
        dineInOrders: number;
        takeoutOrders: number;
        activeOrders: number;
    }>>((acc, order) => {
        if (!order.tableId) return acc;

        const current = acc[order.tableId] || {
            revenue: 0,
            ordersCount: 0,
            lastOrderAt: null,
            dineInOrders: 0,
            takeoutOrders: 0,
            activeOrders: 0,
        };

        if (isRecognizedRevenueOrder(order)) {
            current.revenue += order.total || 0;
        }
        current.ordersCount += 1;
        current.lastOrderAt = order.createdAt.toISOString();
        current.dineInOrders += order.type === 'dine-in' ? 1 : 0;
        current.takeoutOrders += order.type !== 'dine-in' ? 1 : 0;
        current.activeOrders += ['pending', 'preparing', 'ready', 'served'].includes(order.status) ? 1 : 0;

        acc[order.tableId] = current;
        return acc;
    }, {});

    const previousRevenueByTable = previousOrders.reduce<Record<string, number>>((acc, order) => {
        if (!order.tableId) return acc;
        acc[order.tableId] = (acc[order.tableId] || 0) + (isRecognizedRevenueOrder(order) ? (order.total || 0) : 0);
        return acc;
    }, {});

    const byTable = tables.reduce<Record<string, unknown>>((acc, table) => {
        const stats = periodStatsByTable[table.id];
        const revenue = stats?.revenue || 0;
        const previousRevenue = previousRevenueByTable[table.id] || 0;
        const delta = previousRevenue === 0
            ? (revenue > 0 ? 100 : 0)
            : Number((((revenue - previousRevenue) / previousRevenue) * 100).toFixed(1));

        acc[table.id] = {
            revenue,
            ordersCount: stats?.ordersCount || 0,
            avgTicket: stats?.ordersCount ? revenue / stats.ordersCount : 0,
            lastOrderAt: stats?.lastOrderAt || null,
            dineInOrders: stats?.dineInOrders || 0,
            takeoutOrders: stats?.takeoutOrders || 0,
            activeOrders: currentOrderCountByTable[table.id] || 0,
            revenueDeltaPct: delta,
        };
        return acc;
    }, {});

    const recognizedRevenueOrders = periodOrders.filter((order) => isRecognizedRevenueOrder(order));
    const totalRevenue = recognizedRevenueOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const occupiedTables = tables.filter((table) => (
        getTableDisplayStatus({
            status: table.status,
            activeOrderCount: currentOrderCountByTable[table.id] || 0,
        }) === 'occupied'
    )).length;
    const tablesWithSales = Object.values(byTable).filter((entry: any) => entry.ordersCount > 0).length;

    return NextResponse.json({
        range: config.range,
        label: config.label,
        summary: {
            totalRevenue,
            totalOrders: periodOrders.length,
            avgTicket: recognizedRevenueOrders.length > 0 ? totalRevenue / recognizedRevenueOrders.length : 0,
            occupiedTables,
            tablesWithSales,
        },
        byTable,
    });
}
