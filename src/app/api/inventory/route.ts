import { NextRequest, NextResponse } from 'next/server';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { buildInventoryCostMap } from '@/lib/profitability';
import { parseDateInput } from '@/lib/date-only';

function normalizeInventoryPayload(input: Record<string, unknown>) {
    const parseNumber = (value: unknown, fallback = 0) => {
        if (value === '' || value == null) return fallback;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const parseOptionalNumber = (value: unknown) => {
        if (value === '' || value == null) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const parseOptionalDate = (value: unknown) => {
        return parseDateInput(value);
    };

    return {
        name: String(input.name ?? '').trim(),
        category: String(input.category ?? '').trim(),
        unit: String(input.unit ?? '').trim(),
        currentStock: parseNumber(input.currentStock),
        minStock: parseNumber(input.minStock),
        maxStock: parseOptionalNumber(input.maxStock),
        cost: parseOptionalNumber(input.cost),
        supplier: String(input.supplier ?? '').trim() || null,
        location: String(input.location ?? '').trim() || null,
        lastRestocked: parseOptionalDate(input.lastRestocked),
        expiryDate: parseOptionalDate(input.expiryDate),
    };
}

export async function GET(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const inventory = await prisma.inventory.findMany({
        orderBy: { name: 'asc' },
        include: {
            recipes: {
                include: {
                    menuItem: {
                        include: {
                            orderItems: {
                                where: {
                                    order: {
                                        createdAt: { gte: subDays(new Date(), 7) },
                                        status: { not: 'cancelled' },
                                    },
                                },
                                include: {
                                    order: true,
                                    removals: true,
                                    additions: true,
                                },
                            },
                        },
                    },
                },
            },
            extraOptions: {
                include: {
                    orderItemAdditions: {
                        include: {
                            orderItem: {
                                include: {
                                    order: true,
                                },
                            },
                        },
                    },
                },
            },
            purchases: {
                orderBy: { purchasedAt: 'desc' },
            },
        },
    });

    const costMap = buildInventoryCostMap(
        inventory.flatMap((item) => item.purchases),
        inventory.map((item) => ({ id: item.id, cost: item.cost })),
        now
    );

    const itemsWithUsage = inventory.map((item) => {
        const costSnapshot = costMap.get(item.id);
        const weeklyPurchaseSpend = item.purchases
            .filter((purchase) => purchase.purchasedAt >= weekStart && purchase.purchasedAt <= weekEnd)
            .reduce((sum, purchase) => sum + purchase.totalCost, 0);
        const monthlyPurchaseSpend = item.purchases
            .filter((purchase) => purchase.purchasedAt >= monthStart && purchase.purchasedAt <= monthEnd)
            .reduce((sum, purchase) => sum + purchase.totalCost, 0);
        const baseUsage = item.recipes.reduce((sum, recipe) => (
            sum + recipe.menuItem.orderItems.reduce((itemSum, orderItem) => {
                const removedUsage = orderItem.removals
                    .filter((removal) => removal.inventoryId === item.id)
                    .reduce((removalSum, removal) => removalSum + (orderItem.quantity * removal.quantityUsed), 0);

                return itemSum + (orderItem.quantity * recipe.quantityUsed) - removedUsage;
            }, 0)
        ), 0);

        const extraUsage = item.extraOptions.reduce((sum, extraOption) => (
            sum + extraOption.orderItemAdditions.reduce((itemSum, addition) => {
                if (addition.orderItem.order.status === 'cancelled' || addition.orderItem.order.createdAt < subDays(new Date(), 7)) {
                    return itemSum;
                }

                return itemSum + (addition.orderItem.quantity * addition.quantityUsed);
            }, 0)
        ), 0);

        const weeklyUsage = baseUsage + extraUsage;

        const dailyUsage = weeklyUsage / 7;
        const daysRemaining = dailyUsage > 0 ? item.currentStock / dailyUsage : null;
        const recommendedReorderQty = item.maxStock && item.currentStock < item.maxStock
            ? Math.max(0, item.maxStock - item.currentStock)
            : 0;

        let advice: 'reorder_now' | 'reorder_soon' | 'healthy' = 'healthy';
        if (item.currentStock <= item.minStock || (daysRemaining !== null && daysRemaining <= 3)) {
            advice = 'reorder_now';
        } else if (daysRemaining !== null && daysRemaining <= 7) {
            advice = 'reorder_soon';
        }

        const drivers = item.recipes
            .map((recipe) => ({
                menuItemId: recipe.menuItemId,
                menuItemName: recipe.menuItem.name,
                usage: recipe.menuItem.orderItems.reduce((sum, orderItem) => {
                    const removedUsage = orderItem.removals
                        .filter((removal) => removal.inventoryId === item.id)
                        .reduce((removalSum, removal) => removalSum + (orderItem.quantity * removal.quantityUsed), 0);
                    return sum + (orderItem.quantity * recipe.quantityUsed) - removedUsage;
                }, 0),
            }))
            .filter((driver) => driver.usage > 0)
            .sort((a, b) => b.usage - a.usage)
            .slice(0, 3);

        return {
            id: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            currentStock: item.currentStock,
            minStock: item.minStock,
            maxStock: item.maxStock,
            cost: item.cost,
            weightedAverageCost: costSnapshot?.weightedAverageCost ?? item.cost ?? 0,
            latestUnitCost: costSnapshot?.latestUnitCost ?? item.cost ?? null,
            supplier: item.supplier,
            location: item.location,
            lastRestocked: item.lastRestocked,
            lastPurchaseAt: costSnapshot?.lastPurchasedAt ?? null,
            expiryDate: item.expiryDate,
            weeklyUsage,
            dailyUsage,
            daysRemaining,
            recommendedReorderQty,
            advice,
            drivers,
            weeklyPurchaseSpend,
            monthlyPurchaseSpend,
        };
    });

    const purchases = inventory.flatMap((item) => item.purchases.map((purchase) => ({
        id: purchase.id,
        inventoryId: item.id,
        inventoryName: item.name,
        unit: item.unit,
        quantity: purchase.quantity,
        unitCost: purchase.unitCost,
        totalCost: purchase.totalCost,
        supplier: purchase.supplier,
        notes: purchase.notes,
        purchasedAt: purchase.purchasedAt,
    })));

    const adviceSummary = {
        reorderNow: itemsWithUsage.filter((item) => item.advice === 'reorder_now').length,
        reorderSoon: itemsWithUsage.filter((item) => item.advice === 'reorder_soon').length,
        topUsed: [...itemsWithUsage]
            .sort((a, b) => b.weeklyUsage - a.weeklyUsage)
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                name: item.name,
                weeklyUsage: item.weeklyUsage,
                unit: item.unit,
            })),
    };

    const purchaseSummary = {
        weekSpend: purchases
            .filter((purchase) => purchase.purchasedAt >= weekStart && purchase.purchasedAt <= weekEnd)
            .reduce((sum, purchase) => sum + purchase.totalCost, 0),
        monthSpend: purchases
            .filter((purchase) => purchase.purchasedAt >= monthStart && purchase.purchasedAt <= monthEnd)
            .reduce((sum, purchase) => sum + purchase.totalCost, 0),
        recentPurchases: [...purchases]
            .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
            .slice(0, 8),
    };

    return NextResponse.json({
        items: itemsWithUsage,
        adviceSummary,
        purchaseSummary,
    });
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = normalizeInventoryPayload(await req.json());
    if (!data.name || !data.category || !data.unit) {
        return NextResponse.json({ error: 'Name, category, and unit are required' }, { status: 400 });
    }
    const item = await prisma.inventory.create({ data });
    return NextResponse.json(item, { status: 201 });
}
