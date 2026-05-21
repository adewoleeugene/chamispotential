import { prisma } from '@/lib/prisma';
import { SETTINGS_DEFAULTS } from '@/lib/settings';

export async function getTaxRateDecimal() {
  const taxRateSetting = await prisma.settings.findUnique({
    where: { key: 'taxRate' },
    select: { value: true },
  });

  const percent = Number(taxRateSetting?.value ?? SETTINGS_DEFAULTS.taxRate);
  if (Number.isNaN(percent)) {
    return Number(SETTINGS_DEFAULTS.taxRate) / 100;
  }

  return percent / 100;
}

export async function isSettingEnabled(key: string): Promise<boolean> {
  const row = await prisma.settings.findUnique({
    where: { key },
    select: { value: true },
  });
  const fallback = (SETTINGS_DEFAULTS as Record<string, string>)[key];
  const value = row?.value ?? fallback;
  return value === 'true';
}
