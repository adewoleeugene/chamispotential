export const SETTINGS_DEFAULTS = {
  restaurantName: 'Things&Somethings',
  currencySymbol: 'Le',
  taxRate: '10',
  notifyNewOrders: 'true',
  notifyLowInventory: 'true',
  dailyEmailReport: 'false',
  requireManagerOverride: 'true',
  forcePasswordReset: 'true',
} as const;

export type SettingsKey = keyof typeof SETTINGS_DEFAULTS;

export type SettingsPayload = {
  [K in SettingsKey]: string;
};

export function normaliseSettings(
  rows: Array<{ key: string; value: string }>
): SettingsPayload {
  const settings = { ...SETTINGS_DEFAULTS } as SettingsPayload;

  for (const row of rows) {
    if (row.key in settings) {
      settings[row.key as SettingsKey] = row.value;
    }
  }

  return settings;
}
