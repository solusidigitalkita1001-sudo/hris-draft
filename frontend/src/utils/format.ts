import dayjs from 'dayjs';
import { appConfig } from '@/config/app';

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format(appConfig.date.format);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format(appConfig.date.datetimeFormat);
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format(appConfig.date.timeFormat);
}

export function formatCurrency(amount: number | null | undefined, currency = 'IDR'): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '-';
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${value.toFixed(1)}%`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function timeAgo(date: string | Date): string {
  const now = dayjs();
  const then = dayjs(date);
  const diffMinutes = now.diff(then, 'minute');

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${now.diff(then, 'hour')}h ago`;
  if (diffMinutes < 43200) return `${now.diff(then, 'day')}d ago`;
  return formatDate(date);
}
