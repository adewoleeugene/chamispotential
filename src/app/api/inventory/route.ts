import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { subDays } from 'date-fns';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                                include: { order: true },
                            },
                        },
                    },
                },
            },
        },
    });

    const itemsWithUsage = inventory.map((item) => {
        const weeklyUsage = item.recipes.reduce((sum, recipe) => (
            sum + recipe.menuItem.orderItems.reduce((itemSum, orderItem) => (
                itemSum + (orderItem.quantity * recipe.quantityUsed)
            ), 0)
        ), 0);

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
                usage: recipe.menuItem.orderItems.reduce((sum, orderItem) => sum + (orderItem.quantity * recipe.quantityUsed), 0),
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
            supplier: item.supplier,
            location: item.location,
            lastRestocked: item.lastRestocked,
            expiryDate: item.expiryDate,
            weeklyUsage,
            dailyUsage,
            daysRemaining,
            recommendedReorderQty,
            advice,
            drivers,
        };
    });

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

    return NextResponse.json({
        items: itemsWithUsage,
        adviceSummary,
    });
}

export async function POST(req: NextRequest) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await req.json();
    if (data.lastRestocked) data.lastRestocked = new Date(data.lastRestocked);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);
    const item = await prisma.inventory.create({ data });
    return NextResponse.json(item, { status: 201 });
}
