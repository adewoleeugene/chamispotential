import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { buildReportPayload } from '@/lib/report-data';

export async function GET(req: NextRequest) {
    const user = await getRequestUser(req);
    if (!user || !['admin', 'manager'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const payload = await buildReportPayload({
        now: new Date(),
        range: url.searchParams.get('range'),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
        requestedCostMethod: url.searchParams.get('costMethod'),
        isAdmin: user.role === 'admin',
    });

    return NextResponse.json(payload);
}
