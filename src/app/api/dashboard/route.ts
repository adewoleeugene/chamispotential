import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!token || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isWaiter = user.role === 'waiter';
    const waiterWhere = isWaiter ? { userId: user.id } : {};

    const now = new Date();
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
        todayRevenue,
        monthRevenue,
        totalCustomers,
        tableStats,
        topItems,
        recentOrders,
        lowInventory,
        dailyRevenue,
        activeTablesQuery,
    ] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: startOfDay(yesterday), lte: endOfDay(yesterday) }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: weekStart, lte: weekEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'cancelled' } } }),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.order.count({ where: { ...waiterWhere, status: { in: isWaiter ? ['pending', 'preparing'] : ['pending', 'preparing', 'ready'] } } }),
        prisma.order.count({ where: { ...waiterWhere, status: 'ready' } }),
        prisma.order.aggregate({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.order.aggregate({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
        prisma.table.groupBy({ by: ['status'], _count: true }),
        prisma.orderItem.groupBy({
            by: ['menuItemId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
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
        // Last 7 days revenue
        Promise.all(
            Array.from({ length: 7 }, (_, i) => {
                const day = subDays(now, 6 - i);
                return prisma.order.aggregate({
                    where: { createdAt: { gte: startOfDay(day), lte: endOfDay(day) }, status: { not: 'cancelled' } },
                    _sum: { total: true },
                }).then((r: any) => ({ date: day.toISOString().split('T')[0], revenue: r._sum.total || 0 }));
            })
        ),
        // Active tables explicitly mapped with their current active order for the waiter
        prisma.table.findMany({
            where: {
                orders: {
                    some: { ...waiterWhere, status: { in: ['pending', 'preparing', 'ready', 'served'] } }
                }
            },
            include: {
                orders: {
                    where: { ...waiterWhere, status: { in: ['pending', 'preparing', 'ready', 'served'] } },
                    include: { items: { include: { menuItem: true } } },
                    orderBy: { createdAt: 'desc' },
                }
            }
        }),
    ]);

    // Get top items with names
    const topItemsWithNames = await Promise.all(
        topItems.map(async (item: any) => {
            const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
            return { name: menuItem?.name || 'Unknown', quantity: item._sum.quantity || 0 };
        })
    );

    const tableStatusMap = tableStats.reduce((acc: any, t: any) => {
        acc[t.status] = (t._count as number);
        return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
        orders: {
            today: todayOrders,
            yesterday: yesterdayOrders,
            week: weekOrders,
            month: monthOrders,
            pending: pendingOrders,
            active: activeOrders,
            ready: readyOrders,
        },
        revenue: {
            today: todayRevenue._sum.total || 0,
            month: monthRevenue._sum.total || 0,
        },
        customers: totalCustomers,
        tables: tableStatusMap,
        activeTablesCount: activeTablesQuery.length,
        activeTablesList: activeTablesQuery,
        topItems: topItemsWithNames,
        recentOrders,
        lowInventory,
        dailyRevenue,
    });
}
