import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { ReportRange } from '@/lib/restaurant-analytics';

type StandardReportRange = Exclude<ReportRange, 'custom'>;

export type ReportRangeConfig = {
  range: ReportRange;
  label: string;
  start: Date;
  end: Date;
  chartLabel: string;
};

export type StandardReportRangeConfig = Omit<ReportRangeConfig, 'range'> & {
  range: StandardReportRange;
};

function getValidDateParam(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function getReportRange(
  range: string | null,
  now = new Date(),
  startDateParam?: string | null,
  endDateParam?: string | null
): ReportRangeConfig {
  const startDate = getValidDateParam(startDateParam ?? null);
  const endDate = getValidDateParam(endDateParam ?? null);
  const normalized: ReportRange = range === 'day' || range === 'month' || range === 'custom' ? range : 'week';

  if (normalized === 'custom' && startDate && endDate) {
    const start = startOfDay(startDate <= endDate ? startDate : endDate);
    const end = endOfDay(endDate >= startDate ? endDate : startDate);
    return {
      range: normalized,
      label: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      start,
      end,
      chartLabel: 'Custom Range Revenue',
    };
  }

  if (normalized === 'day') {
    return {
      range: normalized,
      label: 'Today',
      start: startOfDay(now),
      end: endOfDay(now),
      chartLabel: 'Hourly Demand',
    };
  }

  if (normalized === 'month') {
    return {
      range: normalized,
      label: 'This Month',
      start: startOfMonth(now),
      end: endOfMonth(now),
      chartLabel: 'Daily Revenue',
    };
  }

  return {
    range: normalized,
    label: 'This Week',
    start: startOfWeek(now),
    end: endOfWeek(now),
    chartLabel: 'Daily Revenue',
  };
}

export function getComparisonRangeConfigs(now = new Date()): {
  week: StandardReportRangeConfig;
  month: StandardReportRangeConfig;
} {
  return {
    week: getReportRange('week', now) as StandardReportRangeConfig,
    month: getReportRange('month', now) as StandardReportRangeConfig,
  };
}

export function getPreviousPeriodRange(config: ReportRangeConfig): ReportRangeConfig {
  const spanDays = Math.max(1, differenceInCalendarDays(config.end, config.start) + 1);
  const previousEnd = endOfDay(subDays(config.start, 1));
  const previousStart = startOfDay(subDays(config.start, spanDays));
  return {
    range: config.range,
    label: `Previous ${config.label}`,
    start: previousStart,
    end: previousEnd,
    chartLabel: config.chartLabel,
  };
}

export function getReportQueryBounds(now = new Date(), config?: ReportRangeConfig) {
  const comparison = getComparisonRangeConfigs(now);
  const previous = config ? getPreviousPeriodRange(config) : null;
  const starts = [comparison.week.start, comparison.month.start];
  const ends = [comparison.week.end, comparison.month.end];

  if (config) {
    starts.push(config.start);
    ends.push(config.end);
  }
  if (previous) {
    starts.push(previous.start);
    ends.push(previous.end);
  }

  return {
    start: starts.reduce((min, current) => (current < min ? current : min)),
    end: ends.reduce((max, current) => (current > max ? current : max)),
  };
}

export function getPurchaseHistoryResolution(config: ReportRangeConfig) {
  if (config.range === 'month') return 'week';
  if (config.range === 'custom') {
    const spanDays = differenceInCalendarDays(config.end, config.start) + 1;
    return spanDays > 31 ? 'week' : 'day';
  }
  return 'day';
}
