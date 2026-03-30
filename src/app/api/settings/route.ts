import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/auth';
import { SETTINGS_DEFAULTS, normaliseSettings } from '@/lib/settings';

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.settings.findMany({
    where: { key: { in: Object.keys(SETTINGS_DEFAULTS) } },
  });

  return NextResponse.json(normaliseSettings(rows));
}

export async function PUT(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const entries = Object.entries(SETTINGS_DEFAULTS).map(([key, fallback]) => ({
    key,
    value: typeof body?.[key] === 'string' ? body[key] : fallback,
  }));

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  return NextResponse.json(
    Object.fromEntries(entries.map(({ key, value }) => [key, value]))
  );
}
