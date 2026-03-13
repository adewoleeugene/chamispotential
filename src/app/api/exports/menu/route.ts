import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/api-middleware';
import { buildCsv, buildCsvResponse } from '@/lib/csv';

function formatDate(value: Date | null | undefined) {
    return value ? value.toISOString() : '';
}

export const GET = withRole(['admin'])(async (req, user) => {
    void req;
    void user;

    const items = await prisma.menuItem.findMany({
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    const csv = buildCsv(
        [
            'Menu Item ID',
            'Name',
            'Description',
            'Category',
            'Price',
            'Cost',
            'Available',
            'Popular',
            'Prep Time (mins)',
            'Calories',
            'Sort Order',
            'Created At',
            'Updated At',
        ],
        items.map((item) => ([
            item.id,
            item.name,
            item.description,
            item.category?.name || '',
            item.price.toFixed(2),
            item.cost?.toFixed(2) || '',
            item.isAvailable ? 'Yes' : 'No',
            item.isPopular ? 'Yes' : 'No',
            item.prepTime ?? '',
            item.calories ?? '',
            item.sortOrder,
            formatDate(item.createdAt),
            formatDate(item.updatedAt),
        ]))
    );

    const filename = `menu-export-${new Date().toISOString().slice(0, 10)}.csv`;
    return buildCsvResponse(filename, csv);
});
