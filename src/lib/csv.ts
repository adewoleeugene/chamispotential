import { NextResponse } from 'next/server';

function escapeCsvValue(value: unknown) {
    if (value == null) return '';

    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

export function buildCsv(headers: string[], rows: Array<Array<unknown>>) {
    const lines = [
        headers.map(escapeCsvValue).join(','),
        ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ];

    return lines.join('\n');
}

export function buildCsvResponse(filename: string, csv: string) {
    return new NextResponse(`\uFEFF${csv}`, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
