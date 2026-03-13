import { NextRequest, NextResponse } from 'next/server';
import {
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

type ReportRange = 'day' | 'week' | 'month';

function getReportRange(range: string | null) {
    const normalized: ReportRange = range === 'day' || range === 'month' ? range : 'week';
    const now = new Date();

    if (normalized === 'day') {
        return {
            range: normalized,
            label: 'Today',
            start: startOfDay(now),
            end: endOfDay(now),
            chartLabel: 'Hourly Demand',
        };
    }

    if (normalized === 'month') {
        return {
            range: normalized,
            label: 'This Month',
            start: startOfMonth(now),
            end: endOfMonth(now),
            chartLabel: 'Daily Revenue',
        };
    }

    return {
        range: normalized,
        label: 'This Week',
        start: startOfWeek(now),
        end: endOfWeek(now),
        chartLabel: 'Daily Revenue',
    };
}

function createDayBuckets(start: Date, end: Date) {
    return eachDayOfInterval({ start, end }).map((date) => ({
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE'),
        revenue: 0,
        orders: 0,
    }));
}

function createHourBuckets() {
    return Array.from({ length: 24 }, (_, hour) => ({
        key: String(hour),
        label: `${String(hour).padStart(2, '0')}:00`,
        revenue: 0,
        orders: 0,
    }));
}

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const config = getReportRange(url.searchParams.get('range'));

    const [orders, menuItems, lowInventory] = await Promise.all([
        prisma.order.findMany({
            where: {
                createdAt: { gte: config.start, lte: config.end },
                status: { not: 'cancelled' },
            },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: {
                            include: { category: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.menuItem.findMany({
            include: { category: true },
        }),
        prisma.inventory.findMany({
            where: { currentStock: { lte: prisma.inventory.fields.minStock } },
            take: 5,
            orderBy: { currentStock: 'asc' },
        }),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;
    const dineInOrders = orders.filter((order) => order.type === 'dine-in').length;
    const takeoutOrders = orders.length - dineInOrders;

    const bucketSeed = config.range === 'day'
        ? createHourBuckets()
        : createDayBuckets(config.start, config.end);
    const bucketMap = new Map(bucketSeed.map((bucket) => [bucket.key, bucket]));

    for (const order of orders) {
        const bucketKey = config.range === 'day'
            ? String(order.createdAt.getHours())
            : format(order.createdAt, 'yyyy-MM-dd');
        const bucket = bucketMap.get(bucketKey);
        if (!bucket) continue;
        bucket.revenue += order.total || 0;
        bucket.orders += 1;
    }

    const itemPerformanceMap = new Map<string, {
        id: string;
        name: string;
        category: string;
        quantity: number;
        revenue: number;
    }>();

    for (const item of menuItems) {
        itemPerformanceMap.set(item.id, {
            id: item.id,
            name: item.name,
            category: item.category?.name || 'Uncategorised',
            quantity: 0,
            revenue: 0,
        });
    }

    for (const order of orders) {
        for (const item of order.items) {
            const current = itemPerformanceMap.get(item.menuItemId);
            if (!current) continue;
            current.quantity += item.quantity;
            current.revenue += item.quantity * item.unitPrice;
        }
    }

    const itemPerformance = Array.from(itemPerformanceMap.values());
    const topItems = [...itemPerformance]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    const slowMovingItems = [...itemPerformance]
        .filter((item) => item.quantity > 0)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);

    const peakBucket = [...bucketSeed].sort((a, b) => b.revenue - a.revenue)[0] || null;
    const bestSeller = topItems[0] || null;
    const weakestSeller = slowMovingItems[0] || null;

    const orderTypeMix = [
        { type: 'dine-in', count: dineInOrders, revenue: orders.filter((order) => order.type === 'dine-in').reduce((sum, order) => sum + (order.total || 0), 0) },
        { type: 'takeout + delivery', count: takeoutOrders, revenue: orders.filter((order) => order.type !== 'dine-in').reduce((sum, order) => sum + (order.total || 0), 0) },
    ].filter((entry) => entry.count > 0);

    const insights = [
        peakBucket
            ? `Peak ${config.range === 'day' ? 'hour' : 'day'}: ${peakBucket.label} drove ${peakBucket.orders} orders and ${peakBucket.revenue.toFixed(2)} in revenue.`
            : null,
        bestSeller
            ? `${bestSeller.name} led the menu with ${bestSeller.quantity} orders in ${config.label.toLowerCase()}.`
            : null,
        weakestSeller
            ? `${weakestSeller.name} remained soft at ${weakestSeller.quantity} orders and may need a pricing or placement review.`
            : null,
        lowInventory.length > 0
            ? `${lowInventory.length} inventory items are already at or below minimum stock and should inform the next purchasing pass.`
            : null,
    ].filter(Boolean);

    return NextResponse.json({
        range: config.range,
        label: config.label,
        chartLabel: config.chartLabel,
        summary: {
            totalRevenue,
            totalOrders: orders.length,
            avgTicket,
            bestSeller: bestSeller?.name || 'No sales yet',
            lowInventoryCount: lowInventory.length,
        },
        trend: bucketSeed,
        orderTypeMix,
        topItems,
        slowMovingItems,
        lowInventory,
        insights,
    });
}
