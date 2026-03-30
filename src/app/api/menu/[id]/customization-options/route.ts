import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import type { CustomizationOptionResponse } from '@/lib/order-customization';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const menuItem = await prisma.menuItem.findUnique({
        where: { id },
        include: {
            recipeIngredients: {
                include: { inventory: true },
                orderBy: { createdAt: 'asc' },
            },
            extraOptions: {
                where: { isActive: true },
                include: { inventory: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
        },
    });

    if (!menuItem) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const response: CustomizationOptionResponse = {
        menuItemId: menuItem.id,
        name: menuItem.name,
        removableParts: menuItem.recipeIngredients.map((ingredient) => ({
            recipeIngredientId: ingredient.id,
            inventoryId: ingredient.inventoryId,
            label: ingredient.inventory.name,
            quantityUsed: ingredient.quantityUsed,
            unit: ingredient.inventory.unit,
        })),
        addableExtras: menuItem.extraOptions.map((extra) => ({
            menuItemExtraOptionId: extra.id,
            inventoryId: extra.inventoryId,
            label: extra.label,
            quantityUsed: extra.quantityUsed,
            unit: extra.inventory.unit,
        })),
    };

    return NextResponse.json(response);
}
