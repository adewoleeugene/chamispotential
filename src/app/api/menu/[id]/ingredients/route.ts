import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function auth(req: NextRequest) {
    const token = req.cookies.get('rms-token')?.value;
    return token ? verifyToken(token) : null;
}

// GET /api/menu/[id]/ingredients — fetch recipe ingredients for a menu item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const ingredients = await prisma.recipeIngredient.findMany({
        where: { menuItemId: id },
        include: { inventory: true },
    });
    return NextResponse.json(ingredients);
}

// POST /api/menu/[id]/ingredients — add an ingredient to this menu item's recipe
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const { inventoryId, quantityUsed } = await req.json();

    if (!inventoryId || quantityUsed == null) {
        return NextResponse.json({ error: 'inventoryId and quantityUsed are required' }, { status: 400 });
    }

    // Upsert: if this menuItem already has this inventoryId, just update the quantity
    const existing = await prisma.recipeIngredient.findFirst({
        where: { menuItemId: id, inventoryId },
    });

    if (existing) {
        const updated = await prisma.recipeIngredient.update({
            where: { id: existing.id },
            data: { quantityUsed },
            include: { inventory: true },
        });
        return NextResponse.json(updated);
    }

    const recipe = await prisma.recipeIngredient.create({
        data: { menuItemId: id, inventoryId, quantityUsed },
        include: { inventory: true },
    });
    return NextResponse.json(recipe, { status: 201 });
}

// DELETE /api/menu/[id]/ingredients — remove a specific ingredient link
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = auth(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { recipeIngredientId } = await req.json();
    await prisma.recipeIngredient.delete({ where: { id: recipeIngredientId } });
    return NextResponse.json({ success: true });
}
