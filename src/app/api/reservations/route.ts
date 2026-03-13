import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reservations = await prisma.reservation.findMany({
        include: { table: true },
        orderBy: { date: 'asc' },
    });
    return NextResponse.json(reservations);
}

export async function POST(req: NextRequest) {
    if (!await getRequestUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data = await req.json();
    const reservation = await prisma.reservation.create({
        data: { ...data, date: new Date(data.date) },
        include: { table: true },
    });
    return NextResponse.json(reservation, { status: 201 });
}
