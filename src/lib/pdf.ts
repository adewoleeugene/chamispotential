import { NextResponse } from 'next/server';

type PdfFont = 'regular' | 'bold' | 'mono';

type PdfLine = {
    text: string;
    font?: PdfFont;
    size?: number;
    color?: [number, number, number];
    gapBefore?: number;
};

type PdfPageSize = 'portrait' | 'landscape';

type PdfDocumentOptions = {
    title: string;
    author?: string;
    subject?: string;
    pageSize?: PdfPageSize;
    lines: PdfLine[];
};

const PAGE_SIZES: Record<PdfPageSize, { width: number; height: number }> = {
    portrait: { width: 612, height: 792 },
    landscape: { width: 792, height: 612 },
};

function escapePdfText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [''];

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            current = word;
            continue;
        }

        if (`${current} ${word}`.length <= maxChars) {
            current = `${current} ${word}`;
            continue;
        }

        lines.push(current);
        current = word;
    }

    if (current) lines.push(current);
    return lines;
}

function getMaxChars(fontSize: number, font: PdfFont, pageWidth: number) {
    const contentWidth = pageWidth - 96;
    const averageGlyphWidth = font === 'mono' ? fontSize * 0.58 : fontSize * 0.5;
    return Math.max(24, Math.floor(contentWidth / averageGlyphWidth));
}

function buildPdfLines(options: PdfDocumentOptions) {
    const { width, height } = PAGE_SIZES[options.pageSize ?? 'portrait'];
    const top = height - 48;
    const bottom = 48;
    const processedPages: Array<Array<PdfLine & { y: number }>> = [];
    let currentPage: Array<PdfLine & { y: number }> = [];
    let cursorY = top;

    for (const line of options.lines) {
        const size = line.size ?? 11;
        const font = line.font ?? 'regular';
        const gapBefore = line.gapBefore ?? 0;
        const wrapped = wrapText(line.text, getMaxChars(size, font, width));

        for (let index = 0; index < wrapped.length; index += 1) {
            const currentGap = index === 0 ? gapBefore : 0;
            const lineHeight = size + 4;
            const nextY = cursorY - currentGap - lineHeight;

            if (nextY < bottom) {
                processedPages.push(currentPage);
                currentPage = [];
                cursorY = top;
            } else {
                cursorY -= currentGap;
            }

            cursorY -= lineHeight;
            currentPage.push({
                ...line,
                text: wrapped[index],
                y: cursorY,
                size,
                font,
            });
        }
    }

    if (currentPage.length > 0) {
        processedPages.push(currentPage);
    }

    return { width, height, pages: processedPages };
}

function padCell(value: string, width: number) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length >= width ? normalized.slice(0, Math.max(0, width - 1)).padEnd(width, ' ') : normalized.padEnd(width, ' ');
}

export function createTableLines(headers: string[], rows: string[][], widths: number[]) {
    const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
    const lines: PdfLine[] = [
        { text: headers.map((header, index) => padCell(header, widths[index])).join(' | '), font: 'mono', size: 9, gapBefore: 8 },
        { text: separator, font: 'mono', size: 9 },
    ];

    for (const row of rows) {
        lines.push({
            text: row.map((cell, index) => padCell(cell, widths[index])).join(' | '),
            font: 'mono',
            size: 9,
        });
    }

    return lines;
}

export function buildPdfBuffer(options: PdfDocumentOptions) {
    const { width, height, pages } = buildPdfLines(options);
    const objects: string[] = [];
    const addObject = (value: string) => {
        objects.push(value);
        return objects.length;
    };

    const catalogId = addObject('');
    const pagesId = addObject('');
    const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const monoFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    const infoId = addObject(
        `<< /Title (${escapePdfText(options.title)})${options.author ? ` /Author (${escapePdfText(options.author)})` : ''}${options.subject ? ` /Subject (${escapePdfText(options.subject)})` : ''} >>`
    );

    const pageIds: number[] = [];

    for (const page of pages) {
        const content = page.map((line) => {
            const fontRef = line.font === 'bold' ? 'F2' : line.font === 'mono' ? 'F3' : 'F1';
            const [r, g, b] = line.color ?? [0.12, 0.16, 0.22];
            return `BT /${fontRef} ${line.size} Tf ${r} ${g} ${b} rg 48 ${line.y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`;
        }).join('\n');
        const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
        const pageId = addObject(
            `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${monoFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
        );
        pageIds.push(pageId);
    }

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
    const offsets: number[] = [0];

    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index += 1) {
        pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
}

export function buildPdfResponse(filename: string, pdf: Buffer) {
    return new NextResponse(pdf, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
