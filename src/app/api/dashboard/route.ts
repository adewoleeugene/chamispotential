import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { POPULARITY_LOOKBACK_DAYS, summarizeMenuPopularity } from '@/lib/menu-popularity';
import { getRecognizedRevenueWhere } from '@/lib/revenue';
import { buildFinancialAnalytics } from '@/lib/restaurant-analytics';
import type { CostMethod } from '@/lib/profitability';
import { getTableDisplayStatus } from '@/lib/table-status';
import { isWaiterRole } from '@/lib/roleRoutes';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isWaiter = isWaiterRole(user.role);
    const waiterWhere = isWaiter ? { userId: user.id } : {};

    const now = new Date();
    const url = new URL(req.url);
    const requestedCostMethod = url.searchParams.get('costMethod');
    const costMethod: CostMethod = user.role === 'admin' && (requestedCostMethod === 'fifo' || requestedCostMethod === 'lifo')
        ? requestedCostMethod
        : 'weighted_average_as_of_sale_date';
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const yesterday = subDays(now, 1);

    const [
        todayOrders,
        yesterdayOrders,
        weekOrders,
        monthOrders,
        pendingOrders,
        activeOrders,
        readyOrders,
        servedToday,
        todayRevenue,
        monthRevenue,
        totalCustomers,
        tableStats,
        recentOrderLines,
        allMenuItems,
        recentOrders,
        lowInventory,
        orderTypeMix,
        activeTablesQuery,
        inventoryCostFallbacks,
        purchases,
        paidOrdersThisWeek,
        paidOrdersThisMonth,
    ] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: startOfDay(yesterday), lte: endOfDay(yesterday) }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: weekStart, lte: weekEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.order.count({ where: { ...waiterWhere, status: { in: isWaiter ? ['pending', 'preparing'] : ['pending', 'preparing', 'ready'] } } }),
        prisma.order.count({ where: { ...waiterWhere, status: 'ready' } }),
        prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ['served', 'completed'] } } }),
        prisma.order.aggregate({ where: getRecognizedRevenueWhere({ createdAt: { gte: todayStart, lte: todayEnd } }), _sum: { total: true } }),
        prisma.order.aggregate({ where: getRecognizedRevenueWhere({ createdAt: { gte: monthStart, lte: monthEnd } }), _sum: { total: true } }),
        prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
        prisma.table.findMany({
            select: {
                id: true,
                status: true,
            },
        }),
        prisma.orderItem.findMany({
            where: {
                order: {
                    status: { not: 'cancelled' },
                    createdAt: { gte: subDays(now, POPULARITY_LOOKBACK_DAYS) },
                },
            },
            select: {
                menuItemId: true,
                quantity: true,
            },
        }),
        prisma.menuItem.findMany({
            select: { id: true, name: true, price: true, category: { select: { name: true } } },
        }),
        prisma.order.findMany({
            where: { ...waiterWhere },
            take: 8,
            orderBy: { createdAt: 'desc' },
            include: { table: true, user: { select: { name: true } }, items: { include: { menuItem: true } } },
        }),
        prisma.inventory.findMany({
            where: { currentStock: { lte: prisma.inventory.fields.minStock } },
            take: 5,
        }),
        prisma.order.groupBy({
            by: ['type'],
            where: getRecognizedRevenueWhere({ createdAt: { gte: monthStart, lte: monthEnd } }),
            _count: true,
            _sum: { total: true },
        }),
        // Active tables explicitly mapped with their current active order for the waiter
        prisma.table.findMany({
            orderBy: { number: 'asc' },
            include: {
                orders: {
                    where: { status: { in: ['draft', 'payment_pending_confirmation', 'pending', 'preparing', 'ready', 'served'] } },
                    select: { id: true, status: true },
                }
            }
        }),
        prisma.inventory.findMany({
            select: { id: true, cost: true },
        }),
        prisma.inventoryPurchase.findMany({
            where: { purchasedAt: { lte: monthEnd } },
            select: {
                inventoryId: true,
                quantity: true,
                unitCost: true,
                totalCost: true,
                purchasedAt: true,
            },
            orderBy: { purchasedAt: 'asc' },
        }),
        prisma.order.findMany({
            where: getRecognizedRevenueWhere({ createdAt: { gte: weekStart, lte: weekEnd } }),
            include: {
                items: {
                    include: {
                        menuItem: {
                            include: {
                                category: true,
                                recipeIngredients: true,
                            },
                        },
                        removals: true,
                        additions: true,
                    },
                },
            },
        }),
        prisma.order.findMany({
            where: getRecognizedRevenueWhere({ createdAt: { gte: monthStart, lte: monthEnd } }),
            include: {
                items: {
                    include: {
                        menuItem: {
                            include: {
                                category: true,
                                recipeIngredients: true,
                            },
                        },
                        removals: true,
                        additions: true,
                    },
                },
            },
        }),
    ]);

    const { quantityByMenuItemId, popularIds } = summarizeMenuPopularity(recentOrderLines);

    const itemPerformance = allMenuItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category?.name || 'Uncategorised',
        quantity: quantityByMenuItemId.get(item.id) || 0,
        estimatedRevenue: (quantityByMenuItemId.get(item.id) || 0) * item.price,
        isPopular: popularIds.has(item.id),
    }));

    const topItemsWithNames = [...itemPerformance]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((item) => ({ name: item.name, quantity: item.quantity }));

    const mostOrderedItem = [...itemPerformance].sort((a, b) => b.quantity - a.quantity)[0] || null;
    const leastOrderedItem = [...itemPerformance].sort((a, b) => a.quantity - b.quantity)[0] || null;
    const slowMovingItems = [...itemPerformance].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
    const weeklyFinancials = buildFinancialAnalytics({
        range: 'week',
        start: weekStart,
        end: weekEnd,
        orders: paidOrdersThisWeek,
        purchases,
        inventory: inventoryCostFallbacks,
        costMethod,
    });
    const monthlyFinancials = buildFinancialAnalytics({
        range: 'month',
        start: monthStart,
        end: monthEnd,
        orders: paidOrdersThisMonth,
        purchases,
        inventory: inventoryCostFallbacks,
        costMethod,
    });
    const peakRevenueDay = [...monthlyFinancials.trend].sort((a, b) => b.netSales - a.netSales)[0] || null;
    const avgTicket = monthlyFinancials.summary.avgTicket;

    const decisionInsights = [
        peakRevenueDay
            ? {
                title: 'Peak revenue day',
                detail: `${peakRevenueDay.label} brought in ${peakRevenueDay.netSales.toFixed(2)} in net sales across ${peakRevenueDay.orders} paid orders.`,
              }
            : null,
        mostOrderedItem
            ? {
                title: 'Best seller',
                detail: `${mostOrderedItem.name} led demand with ${mostOrderedItem.quantity} orders this period.`,
              }
            : null,
        leastOrderedItem
            ? {
                title: 'Slowest mover',
                detail: `${leastOrderedItem.name} recorded ${leastOrderedItem.quantity} orders and may need promotion, repositioning, or removal.`,
              }
            : null,
        lowInventory.length > 0
            ? {
                title: 'Inventory pressure',
                detail: `${lowInventory.length} inventory items are already at or below minimum stock.`,
              }
            : null,
    ].filter(Boolean);

    // Tables that actually have active orders (subset of all tables)
    const activeTableIds = new Set(
        activeTablesQuery.filter(t => t.orders.length > 0).map(t => t.id)
    );
    const tableStatusMap = tableStats.reduce<Record<string, number>>((acc, t) => {
        const displayStatus = getTableDisplayStatus({
            status: t.status,
            activeOrderCount: activeTableIds.has(t.id) ? 1 : 0,
        });
        acc[displayStatus] = (acc[displayStatus] || 0) + 1;
        return acc;
    }, {});

    const activeTablesListWithStatus = activeTablesQuery.map(t => ({
        ...t,
        displayStatus: getTableDisplayStatus({ status: t.status, activeOrderCount: t.orders.length }),
    }));

    return NextResponse.json({
        orders: {
            today: todayOrders,
            yesterday: yesterdayOrders,
            week: weekOrders,
            month: monthOrders,
            pending: pendingOrders,
            active: activeOrders,
            ready: readyOrders,
            servedToday,
        },
        revenue: {
            today: todayRevenue._sum.total || 0,
            month: monthRevenue._sum.total || 0,
            peakDay: peakRevenueDay,
            averageTicket: avgTicket,
        },
        finance: {
            costMethod,
            week: {
                netSales: weeklyFinancials.summary.netSales,
                ingredientSpend: weeklyFinancials.summary.ingredientSpend,
                cogs: weeklyFinancials.summary.cogs,
                grossProfit: weeklyFinancials.summary.grossProfit,
                grossMarginPct: weeklyFinancials.summary.grossMarginPct,
            },
            month: {
                netSales: monthlyFinancials.summary.netSales,
                ingredientSpend: monthlyFinancials.summary.ingredientSpend,
                cogs: monthlyFinancials.summary.cogs,
                grossProfit: monthlyFinancials.summary.grossProfit,
                grossMarginPct: monthlyFinancials.summary.grossMarginPct,
            },
        },
        customers: totalCustomers,
        tables: tableStatusMap,
        activeTablesCount: activeTableIds.size,
        activeTablesList: activeTablesListWithStatus,
        topItems: topItemsWithNames,
        mostOrderedItem,
        leastOrderedItem,
        slowMovingItems,
        orderTypeMix,
        recentOrders,
        lowInventory,
        dailyRevenue: weeklyFinancials.trend,
        monthDailyRevenue: monthlyFinancials.trend,
        itemProfitability: monthlyFinancials.itemProfitability,
        highMarginItems: monthlyFinancials.highMarginItems,
        lowMarginItems: monthlyFinancials.lowMarginItems,
        decisionInsights,
    });
}
