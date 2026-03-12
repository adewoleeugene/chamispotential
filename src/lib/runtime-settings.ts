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
