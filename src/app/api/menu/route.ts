import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { subDays } from 'date-fns';
import { POPULARITY_LOOKBACK_DAYS, summarizeMenuPopularity } from '@/lib/menu-popularity';

function normalizeMenuItemPayload(input: Record<string, unknown>) {
    const costValue = input.cost;
    const parsedCost = costValue === '' || costValue == null ? null : Number(costValue);

    return {
        name: String(input.name ?? '').trim(),
        description: String(input.description ?? '').trim() || null,
        price: Number(input.price),
        cost: Number.isFinite(parsedCost as number) ? parsedCost : null,
        categoryId: String(input.categoryId ?? '').trim(),
    };
}

export async function GET(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const since = subDays(new Date(), POPULARITY_LOOKBACK_DAYS);
    const [items, recentOrderLines] = await Promise.all([
        prisma.menuItem.findMany({
            include: {
                category: true,
                extraOptions: {
                    where: { isActive: true },
                    include: { inventory: true },
                    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
            },
            orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        }),
        prisma.orderItem.findMany({
            where: {
                order: {
                    status: { not: 'cancelled' },
                    createdAt: { gte: since },
                },
            },
            select: {
                menuItemId: true,
                quantity: true,
            },
        }),
    ]);

    const { popularIds } = summarizeMenuPopularity(recentOrderLines);

    return NextResponse.json(
        items.map((item) => ({
            ...item,
            isPopular: popularIds.has(item.id),
        }))
    );
}

export async function POST(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = normalizeMenuItemPayload(await req.json());
    if (!data.name || !data.categoryId || !Number.isFinite(data.price)) {
        return NextResponse.json({ error: 'Name, category, and a valid price are required' }, { status: 400 });
    }
    const item = await prisma.menuItem.create({
        data,
        include: {
            category: true,
            extraOptions: {
                where: { isActive: true },
                include: { inventory: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
        },
    });
    return NextResponse.json(item, { status: 201 });
}
