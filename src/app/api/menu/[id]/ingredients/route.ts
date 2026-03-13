import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

type IngredientInput = {
    inventoryId: string;
    quantityUsed: number;
};

function normalizeIngredientInput(input: unknown): IngredientInput | null {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const data = input as Record<string, unknown>;
    const inventoryId = String(data.inventoryId ?? '').trim();
    const quantityUsed = Number(data.quantityUsed);

    if (!inventoryId || !Number.isFinite(quantityUsed) || quantityUsed <= 0) {
        return null;
    }

    return { inventoryId, quantityUsed };
}

// GET /api/menu/[id]/ingredients — fetch recipe ingredients for a menu item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const ingredients = await prisma.recipeIngredient.findMany({
        where: { menuItemId: id },
        include: { inventory: true },
    });
    return NextResponse.json(ingredients);
}

// POST /api/menu/[id]/ingredients — add an ingredient to this menu item's recipe
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json() as { ingredients?: unknown[] } | unknown;
    const incomingIngredients: Array<IngredientInput | null> = Array.isArray((body as { ingredients?: unknown[] })?.ingredients)
        ? ((body as { ingredients: unknown[] }).ingredients).map(normalizeIngredientInput)
        : [normalizeIngredientInput(body)];
    const ingredients = incomingIngredients.filter((ingredient): ingredient is IngredientInput => ingredient !== null);

    if (ingredients.length === 0) {
        return NextResponse.json({ error: 'At least one valid ingredient is required' }, { status: 400 });
    }

    const uniqueInventoryIds = new Set(ingredients.map((ingredient) => ingredient.inventoryId));
    if (uniqueInventoryIds.size !== ingredients.length) {
        return NextResponse.json({ error: 'Duplicate inventory items are not allowed in the same request' }, { status: 400 });
    }

    const savedIngredients = await prisma.$transaction(async (tx) => Promise.all(
        ingredients.map(async ({ inventoryId, quantityUsed }) => {
            const existing = await tx.recipeIngredient.findFirst({
                where: { menuItemId: id, inventoryId },
            });

            if (existing) {
                return tx.recipeIngredient.update({
                    where: { id: existing.id },
                    data: { quantityUsed },
                    include: { inventory: true },
                });
            }

            return tx.recipeIngredient.create({
                data: { menuItemId: id, inventoryId, quantityUsed },
                include: { inventory: true },
            });
        })
    ));

    if (savedIngredients.length === 1) {
        return NextResponse.json(savedIngredients[0], { status: 201 });
    }

    return NextResponse.json(savedIngredients, { status: 201 });
}

// DELETE /api/menu/[id]/ingredients — remove a specific ingredient link
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const { recipeIngredientId } = await req.json();
    const deleted = await prisma.recipeIngredient.deleteMany({
        where: {
            id: recipeIngredientId,
            menuItemId: id,
        },
    });

    if (deleted.count === 0) {
        return NextResponse.json({ error: 'Ingredient link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
