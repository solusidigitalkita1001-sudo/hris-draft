import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { workCalendarService, type WorkCalendar, type CalendarDay, type DayType, type WorkDayKey } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import {
  ChevronLeft, ChevronRight, RefreshCw, ArrowLeft, CalendarDays,
  Sparkles, Save, Copy, Upload, LayoutGrid, TableProperties,
} from 'lucide-react';

// ─── Day type config ────────────────────────────────────
interface DayTypeConfig {
  label: string;
  short: string;
  color: string;
  bg: string;
  darkBg: string;
  text: string;
  dot: string;
}

const DAY_TYPE_CONFIG: Record<DayType, DayTypeConfig> = {
  WD: { label: 'Working Day', short: 'W', color: 'bg-emerald-500', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  WS: { label: 'Working Sat/Shift', short: 'S', color: 'bg-blue-500', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  WE: { label: 'Weekend', short: 'W', color: 'bg-gray-300', bg: 'bg-gray-50', darkBg: 'dark:bg-gray-800/50', text: 'text-gray-400 dark:text-gray-500', dot: 'bg-gray-300' },
  NH: { label: 'National Holiday', short: 'H', color: 'bg-red-500', bg: 'bg-red-50', darkBg: 'dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  JL: { label: 'Joint Leave', short: 'L', color: 'bg-purple-500', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  CH: { label: 'Company Holiday', short: 'C', color: 'bg-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  RH: { label: 'Religious Holiday', short: 'R', color: 'bg-pink-500', bg: 'bg-pink-50', darkBg: 'dark:bg-pink-950/30', text: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-500' },
  OT: { label: 'Overtime', short: 'O', color: 'bg-amber-500', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
};

const DAY_TYPES: DayType[] = ['WD', 'WS', 'WE', 'NH', 'JL', 'CH', 'RH', 'OT'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WORK_DAY_KEYS_BY_INDEX: WorkDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type CsvCalendarRow = {
  date: string;
  dayType: DayType;
  name?: string;
  notes?: string;
  workStart?: string | null;
  workEnd?: string | null;
  isMandatory?: boolean;
};

const CSV_HEADER_ALIASES = {
  date: ['date', 'tanggal'],
  dayType: ['daytype', 'day_type', 'jenis_hari', 'type'],
  name: ['name', 'holiday_name', 'nama', 'keterangan'],
  notes: ['notes', 'note', 'catatan', 'remarks'],
  workStart: ['workstart', 'work_start', 'start', 'jammasuk', 'jam_masuk'],
  workEnd: ['workend', 'work_end', 'end', 'jampulang', 'jam_pulang'],
  isMandatory: ['ismandatory', 'is_mandatory', 'mandatory', 'wajib'],
} as const;

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function resolveCsvIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(normalizeCsvHeader(header)));
}

function normalizeCsvDayType(value: string): DayType | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
  const mapping: Record<string, DayType> = {
    WD: 'WD',
    WORKING_DAY: 'WD',
    WORKDAY: 'WD',
    WS: 'WS',
    WORKING_SAT_SHIFT: 'WS',
    SHIFT: 'WS',
    WE: 'WE',
    WEEKEND: 'WE',
    NH: 'NH',
    NATIONAL_HOLIDAY: 'NH',
    JL: 'JL',
    JOINT_LEAVE: 'JL',
    CH: 'CH',
    COMPANY_HOLIDAY: 'CH',
    RH: 'RH',
    RELIGIOUS_HOLIDAY: 'RH',
    OT: 'OT',
    OVERTIME: 'OT',
  };

  return mapping[normalized] || null;
}

function normalizeCsvBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'y', 'ya'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'tidak'].includes(normalized)) return false;
  return undefined;
}

function normalizeCsvTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseCalendarCsv(text: string) {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    throw new Error('CSV minimal harus memiliki header dan 1 baris data.');
  }

  const headers = parseCsvLine(rows[0]);
  const dateIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.date);
  const dayTypeIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.dayType);
  const nameIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.name);
  const notesIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.notes);
  const workStartIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.workStart);
  const workEndIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.workEnd);
  const isMandatoryIndex = resolveCsvIndex(headers, CSV_HEADER_ALIASES.isMandatory);

  if (dateIndex === -1 || dayTypeIndex === -1) {
    throw new Error('Header CSV wajib memiliki kolom `date` dan `dayType`.');
  }

  const parsedRows: CsvCalendarRow[] = rows.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const date = values[dateIndex]?.trim();
    const dayType = normalizeCsvDayType(values[dayTypeIndex] || '');
    const name = nameIndex >= 0 ? values[nameIndex]?.trim() || undefined : undefined;
    const notes = notesIndex >= 0 ? values[notesIndex]?.trim() || undefined : undefined;
    const workStart = workStartIndex >= 0 ? normalizeCsvTime(values[workStartIndex] || '') : undefined;
    const workEnd = workEndIndex >= 0 ? normalizeCsvTime(values[workEndIndex] || '') : undefined;
    const isMandatory = isMandatoryIndex >= 0 ? normalizeCsvBoolean(values[isMandatoryIndex] || '') : undefined;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Format tanggal tidak valid pada baris ${index + 2}. Gunakan YYYY-MM-DD.`);
    }

    if (!dayType) {
      throw new Error(`dayType tidak valid pada baris ${index + 2}. Gunakan WD, WS, WE, NH, JL, CH, RH, atau OT.`);
    }

    if (workStart === null || workEnd === null) {
      throw new Error(`Format jam tidak valid pada baris ${index + 2}. Gunakan HH:mm.`);
    }

    return {
      date,
      dayType,
      name,
      notes,
      workStart,
      workEnd,
      isMandatory,
    };
  });

  if (parsedRows.length === 0) {
    throw new Error('Tidak ada data yang bisa diimport dari file CSV.');
  }

  return parsedRows;
}

// ─── Copy Dialog ────────────────────────────────────────
function CopyDialog({ open, onClose, onCopy, calendar }: {
  open: boolean; onClose: () => void;
  onCopy: (targetYear: number, name?: string) => Promise<void>;
  calendar: WorkCalendar;
}) {
  const [targetYear, setTargetYear] = useState(calendar.year + 1);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    setSaving(true);
    try {
      await onCopy(targetYear, name || undefined);
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Copy Calendar</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy <strong>{calendar.name}</strong> ({calendar.year}) to:
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Target Year *</label>
            <Input type="number" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} min={2000} max={2100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New Name (optional)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Copy ${targetYear}`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleCopy} disabled={saving}>{saving ? 'Copying...' : 'Copy'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export function WorkCalendarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const urlYear = Number(searchParams.get('year')) || dayjs().year();
  const urlMonth = Number(searchParams.get('month')) || dayjs().month() + 1;

  const [calendar, setCalendar] = useState<WorkCalendar | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentYear, setCurrentYear] = useState(urlYear);
  const [currentMonth, setCurrentMonth] = useState(urlMonth);
  const [editingDays, setEditingDays] = useState<Record<string, DayType>>({});
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [editingStarts, setEditingStarts] = useState<Record<string, string>>({});
  const [editingEnds, setEditingEnds] = useState<Record<string, string>>({});
  const [hasEdits, setHasEdits] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Update URL when month changes
  useEffect(() => {
    setSearchParams({ year: String(currentYear), month: String(currentMonth) }, { replace: true });
  }, [currentYear, currentMonth, setSearchParams]);

  // Fetch calendar + days
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cal, dayData] = await Promise.all([
        workCalendarService.findById(id),
        workCalendarService.findDays(id, currentYear, currentMonth),
      ]);
      setCalendar(cal);
      setDays(dayData);
      setEditingDays({});
      setEditingNames({});
      setEditingStarts({});
      setEditingEnds({});
      setHasEdits(false);
    } catch (error) {
      console.error('Failed to load calendar:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [id, currentYear, currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Generate calendar grid
  const generateGrid = useCallback(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const dayMap = new Map(days.map((d) => [dayjs(d.date).format('YYYY-MM-DD'), d]));

    const grid: { date: Date; day: number; iso: string; dayOfWeek: number; calDay?: CalendarDay }[] = [];

    // Padding days from previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      const d = new Date(currentYear, currentMonth - 1, -startDayOfWeek + i + 1);
      grid.push({ date: d, day: d.getDate(), iso: dayjs(d).format('YYYY-MM-DD'), dayOfWeek: d.getDay() });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentYear, currentMonth - 1, i);
      const iso = dayjs(d).format('YYYY-MM-DD');
      grid.push({ date: d, day: i, iso, dayOfWeek: d.getDay(), calDay: dayMap.get(iso) });
    }

    // Padding days from next month
    const remaining = 7 - (grid.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(currentYear, currentMonth, i);
        grid.push({ date: d, day: d.getDate(), iso: dayjs(d).format('YYYY-MM-DD'), dayOfWeek: d.getDay() });
      }
    }

    // Split into weeks
    const weeks: typeof grid[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      weeks.push(grid.slice(i, i + 7));
    }
    return weeks;
  }, [days, currentYear, currentMonth]);

  const weeks = generateGrid();
  const tableRows = weeks
    .flat()
    .filter((cell) => cell.date.getMonth() === currentMonth - 1 && cell.date.getFullYear() === currentYear);

  // Get day type for a given iso date
  const getDayType = (iso: string, calDay?: CalendarDay): DayType => {
    if (editingDays[iso]) return editingDays[iso];
    if (calDay) return calDay.dayType as DayType;

    // Default: WD for weekdays, WE for weekends
    const date = new Date(iso);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? 'WE' : 'WD';
  };

  const getDayName = (iso: string, calDay?: CalendarDay): string => {
    if (editingNames[iso] !== undefined) return editingNames[iso];
    return calDay?.name || '';
  };

  const getDefaultTimes = (iso: string) => {
    if (!calendar) return { workStart: '', workEnd: '' };
    const dayKey = WORK_DAY_KEYS_BY_INDEX[new Date(iso).getDay()];
    const rule = calendar.workDays[dayKey];
    return {
      workStart: rule?.enabled ? rule.workStart || '' : '',
      workEnd: rule?.enabled ? rule.workEnd || '' : '',
    };
  };

  const getDayStart = (iso: string, calDay?: CalendarDay): string => {
    if (editingStarts[iso] !== undefined) return editingStarts[iso];
    if (calDay?.workStart) return calDay.workStart;
    return getDefaultTimes(iso).workStart;
  };

  const getDayEnd = (iso: string, calDay?: CalendarDay): string => {
    if (editingEnds[iso] !== undefined) return editingEnds[iso];
    if (calDay?.workEnd) return calDay.workEnd;
    return getDefaultTimes(iso).workEnd;
  };

  const changeDayType = (iso: string, dayType: DayType, _calDay?: CalendarDay) => {
    setEditingDays((prev) => ({ ...prev, [iso]: dayType }));
    if (!['WD', 'WS', 'OT'].includes(dayType)) {
      setEditingStarts((prev) => ({ ...prev, [iso]: '' }));
      setEditingEnds((prev) => ({ ...prev, [iso]: '' }));
    }
    setHasEdits(true);
  };

  const changeDayName = (iso: string, name: string) => {
    setEditingNames((prev) => ({ ...prev, [iso]: name }));
    setHasEdits(true);
  };

  const changeDayStart = (iso: string, value: string) => {
    setEditingStarts((prev) => ({ ...prev, [iso]: value }));
    setHasEdits(true);
  };

  const changeDayEnd = (iso: string, value: string) => {
    setEditingEnds((prev) => ({ ...prev, [iso]: value }));
    setHasEdits(true);
  };

  // Save changes
  const handleSave = async () => {
    if (!id) return;
    const changedDates = new Set([
      ...Object.keys(editingDays),
      ...Object.keys(editingNames),
      ...Object.keys(editingStarts),
      ...Object.keys(editingEnds),
    ]);
    const changedDays = Array.from(changedDates).map((date) => ({
      date,
      dayType: editingDays[date] || getDayType(date, days.find((day) => dayjs(day.date).format('YYYY-MM-DD') === date)),
      name: editingNames[date] || undefined,
      workStart: editingStarts[date] !== undefined ? (editingStarts[date] || null) : undefined,
      workEnd: editingEnds[date] !== undefined ? (editingEnds[date] || null) : undefined,
    }));
    if (changedDays.length === 0) {
      toast('No changes to save');
      return;
    }
    setSaving(true);
    try {
      await workCalendarService.bulkUpdateDays(id, changedDays);
      toast.success(`${changedDays.length} day(s) updated`);
      setEditingDays({});
      setEditingNames({});
      setEditingStarts({});
      setEditingEnds({});
      setHasEdits(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Generate default days
  const handleGenerateDefaults = async () => {
    if (!id) return;
    const confirmed = await popup.confirm({
      title: 'Generate Default Days',
      description: 'This will reset all days for this month to the calendar defaults. Continue?',
      confirmText: 'Generate',
      cancelText: 'Cancel',
      intent: 'destructive',
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await workCalendarService.generateDefaultDays(id);
      toast.success('Default days generated');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate defaults');
    } finally {
      setSaving(false);
    }
  };

  // Copy calendar
  const handleCopy = async (targetYear: number, name?: string) => {
    if (!id) return;
    try {
      const newCal = await workCalendarService.copyCalendar(id, targetYear, name);
      toast.success(`Calendar copied to ${targetYear}`);
      navigate(`/work-calendar/${newCal.id}?year=${targetYear}&month=1`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to copy calendar');
      throw err;
    }
  };

  const handleCsvUploadClick = async () => {
    const confirmed = await popup.confirm({
      title: 'Import Kalender Dari CSV',
      description: 'Pastikan file CSV memiliki kolom date dan dayType. Kolom opsional: name, notes, workStart, workEnd, isMandatory.',
      confirmText: 'Pilih File',
      cancelText: 'Batal',
    });

    if (!confirmed) return;
    csvInputRef.current?.click();
  };

  const handleCsvFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !id) return;

    setImportingCsv(true);
    try {
      const csvText = await file.text();
      const parsedRows = parseCalendarCsv(csvText);

      await workCalendarService.bulkUpdateDays(id, parsedRows);
      toast.success(`${parsedRows.length} hari berhasil diimport dari CSV`);
      setEditingDays({});
      setEditingNames({});
      setEditingStarts({});
      setEditingEnds({});
      setHasEdits(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Gagal import CSV');
    } finally {
      setImportingCsv(false);
    }
  };

  // Navigation
  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1); }
    else setCurrentMonth((m) => m + 1);
  };

  const goToday = () => {
    const now = dayjs();
    setCurrentYear(now.year());
    setCurrentMonth(now.month() + 1);
  };

  const isCurrentMonth = currentYear === dayjs().year() && currentMonth === dayjs().month() + 1;

  // Summary stats for current view
  const summary = days.reduce(
    (acc, d) => {
      const dt = d.dayType as DayType;
      acc[dt] = (acc[dt] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <PageHeader
        title={calendar ? `${calendar.name} — ${currentYear}` : 'Work Calendar'}
        description={calendar ? `View and manage working days` : 'Loading...'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/work-calendar')}>
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateDefaults} disabled={saving || loading}>
              <Sparkles size={16} className="mr-2" /> Generate
            </Button>
            {calendar && (
              <Button variant="outline" size="sm" onClick={() => setShowCopy(true)}>
                <Copy size={16} className="mr-2" /> Copy
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCsvUploadClick} disabled={loading || importingCsv || saving}>
              <Upload size={16} className="mr-2" /> {importingCsv ? 'Importing...' : 'Import CSV'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasEdits || saving}>
              <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading calendar...</div>
        </div>
      )}

      {!loading && !calendar && (
        <div className="flex flex-col items-center py-20 gap-3">
          <CalendarDays size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Calendar not found</p>
          <Button size="sm" onClick={() => navigate('/work-calendar')}>Back to Calendars</Button>
        </div>
      )}

      {!loading && calendar && (
        <>
          {/* Month navigation + legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            {/* Month nav */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={prevMonth}>
                  <ChevronLeft size={16} />
                </Button>
                <button onClick={goToday} className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  isCurrentMonth ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary/50'
                }`}>
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight size={16} />
                </Button>
              </div>

              <div className="inline-flex rounded-lg border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TableProperties size={14} />
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid size={14} />
                  Calendar
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2">
              {DAY_TYPES.map((dt) => (
                <div key={dt} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${DAY_TYPE_CONFIG[dt].dot}`} />
                  <span className="text-xs text-muted-foreground">{DAY_TYPE_CONFIG[dt].short}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(summary).map(([dt, count]) => (
              <div key={dt} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${DAY_TYPE_CONFIG[dt as DayType].bg} ${DAY_TYPE_CONFIG[dt as DayType].text}`}>
                {DAY_TYPE_CONFIG[dt as DayType].label}: {count}
              </div>
            ))}
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-hidden rounded-xl border border-border bg-white dark:bg-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Hari</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipe</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Jam Masuk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Jam Pulang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Nama / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tableRows.map((cell) => {
                      const dayType = getDayType(cell.iso, cell.calDay);
                      const cfg = DAY_TYPE_CONFIG[dayType];
                      const dayName = getDayName(cell.iso, cell.calDay);
                      const dayStart = getDayStart(cell.iso, cell.calDay);
                      const dayEnd = getDayEnd(cell.iso, cell.calDay);
                      const showsTimeEditor = ['WD', 'WS', 'OT'].includes(dayType);
                      const showsNameEditor = ['NH', 'JL', 'CH', 'RH'].includes(dayType);
                      const isToday = dayjs(cell.date).isSame(dayjs(), 'day');

                      return (
                        <tr key={cell.iso} className={isToday ? 'bg-primary/5' : ''}>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-foreground">{dayjs(cell.date).format('DD MMM YYYY')}</div>
                            <div className="text-xs text-muted-foreground">{cell.iso}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{DAY_NAMES[cell.dayOfWeek]}</td>
                          <td className="px-4 py-3">
                            <Select2
                              value={dayType}
                              onValueChange={(value) => changeDayType(cell.iso, value as DayType, cell.calDay)}
                              options={DAY_TYPES.map((dt) => ({ value: dt, label: DAY_TYPE_CONFIG[dt].label }))}
                              className={`h-9 min-w-[10rem] border-transparent ${cfg.bg} ${cfg.text}`}
                              contentClassName="min-w-[10rem]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {showsTimeEditor ? (
                              <Input
                                type="time"
                                value={dayStart}
                                onChange={(e) => changeDayStart(cell.iso, e.target.value)}
                                className="h-9"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {showsTimeEditor ? (
                              <Input
                                type="time"
                                value={dayEnd}
                                onChange={(e) => changeDayEnd(cell.iso, e.target.value)}
                                className="h-9"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {showsNameEditor ? (
                              <Input
                                value={dayName}
                                onChange={(e) => changeDayName(cell.iso, e.target.value)}
                                placeholder="Isi nama hari/libur"
                                className="h-9"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border">
                {DAY_NAMES.map((name, i) => (
                  <div key={i} className={`px-3 py-2.5 text-xs font-medium text-muted-foreground text-center uppercase tracking-wider ${
                    i === 0 || i === 6 ? 'text-red-400' : ''
                  }`}>
                    {name}
                  </div>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-border/50 last:border-b-0">
                  {week.map((cell) => {
                    const isCurrentMonthDay =
                      cell.date.getMonth() === currentMonth - 1 &&
                      cell.date.getFullYear() === currentYear;
                    const isToday = dayjs(cell.date).isSame(dayjs(), 'day');
                    const dayType = getDayType(cell.iso, cell.calDay);
                    const cfg = DAY_TYPE_CONFIG[dayType];
                    const dayName = getDayName(cell.iso, cell.calDay);
                    const dayStart = getDayStart(cell.iso, cell.calDay);
                    const dayEnd = getDayEnd(cell.iso, cell.calDay);
                    const isWeekend = cell.dayOfWeek === 0 || cell.dayOfWeek === 6;
                    const showsTimeEditor = ['WD', 'WS', 'OT'].includes(dayType);

                    return (
                      <div
                        key={cell.iso}
                        className={`min-h-[80px] p-1.5 border-r border-border/30 last:border-r-0 transition-colors relative ${
                          isCurrentMonthDay ? cfg.bg + ' ' + cfg.darkBg : 'bg-gray-50/50 dark:bg-gray-900/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-primary text-primary-foreground'
                              : isCurrentMonthDay
                                ? isWeekend ? 'text-red-400' : 'text-foreground'
                                : 'text-muted-foreground/40'
                          }`}>
                            {cell.day}
                          </span>
                        </div>

                        {isCurrentMonthDay && (
                          <>
                            <Select2
                              value={dayType}
                              onValueChange={(value) => changeDayType(cell.iso, value as DayType, cell.calDay)}
                              options={DAY_TYPES.map((dt) => ({ value: dt, label: DAY_TYPE_CONFIG[dt].label }))}
                              className={`h-7 w-full border-transparent px-1 py-0 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
                              contentClassName="min-w-[8rem]"
                            />

                            {showsTimeEditor && (
                              <div className="mt-1 grid grid-cols-2 gap-1">
                                <input
                                  type="time"
                                  value={dayStart}
                                  onChange={(e) => changeDayStart(cell.iso, e.target.value)}
                                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground outline-none focus:border-primary"
                                />
                                <input
                                  type="time"
                                  value={dayEnd}
                                  onChange={(e) => changeDayEnd(cell.iso, e.target.value)}
                                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground outline-none focus:border-primary"
                                />
                              </div>
                            )}

                            {(dayType === 'NH' || dayType === 'JL' || dayType === 'CH' || dayType === 'RH') && (
                              <input
                                value={dayName}
                                onChange={(e) => changeDayName(cell.iso, e.target.value)}
                                placeholder="Holiday name..."
                                className="w-full text-[10px] mt-0.5 px-1 py-0.5 rounded border border-transparent bg-transparent text-muted-foreground placeholder:text-muted-foreground/30 focus:border-primary outline-none"
                              />
                            )}
                          </>
                        )}

                        {!isCurrentMonthDay && dayName && (
                          <span className="text-[10px] text-muted-foreground block truncate">{dayName}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvFileChange}
      />

      {/* Copy dialog */}
      {calendar && (
        <CopyDialog
          open={showCopy}
          onClose={() => setShowCopy(false)}
          onCopy={handleCopy}
          calendar={calendar}
        />
      )}
    </div>
  );
}
