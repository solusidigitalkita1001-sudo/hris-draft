import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { attendanceService, type AttendanceRecord } from '@/services/attendance.service';
import { employeeService } from '@/services/employee.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle, LogIn, LogOut, Clock9 } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PRESENT: <CheckCircle2 size={14} className="text-emerald-500" />,
  ABSENT: <XCircle size={14} className="text-red-500" />,
  LATE: <AlertTriangle size={14} className="text-amber-500" />,
  EXCUSED: <Clock size={14} className="text-blue-500" />,
};

const STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ABSENT: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  LATE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  EXCUSED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

/* ---------- Modal backdrop ---------- */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Check-In form ---------- */
function CheckInForm({ employees, onSave, onClose }: {
  employees: { id: string; fullName: string }[];
  onSave: (data: { employeeId: string; date: string; checkIn: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(now);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !date || !time) return toast.error('Employee, date, and time are required');
    setSaving(true);
    try {
      await onSave({ employeeId, date, checkIn: time });
      onClose();
    } catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</label>
        <Select2
          value={employeeId}
          onValueChange={setEmployeeId}
          options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
          placeholder="Select employee"
          className="h-9"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time *</label>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Check In'}</Button>
      </div>
    </form>
  );
}

/* ---------- Overtime form ---------- */
function OvertimeForm({ employees, onSave, onClose }: {
  employees: { id: string; fullName: string }[];
  onSave: (data: { employeeId: string; date: string; startTime: string; endTime: string; durationHours: number; reason: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState(now);
  const [endTime, setEndTime] = useState('');
  const [durationHours, setDurationHours] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !date || !startTime || !endTime || !reason.trim()) {
      return toast.error('All fields are required');
    }
    setSaving(true);
    try {
      await onSave({ employeeId, date, startTime, endTime, durationHours, reason: reason.trim() });
      onClose();
    } catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  // Auto-compute duration when both times are filled
  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (startTime && val) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = val.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) setDurationHours(Math.round((diff / 60) * 10) / 10);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</label>
        <Select2
          value={employeeId}
          onValueChange={setEmployeeId}
          options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
          placeholder="Select employee"
          className="h-9"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Time *</label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Time *</label>
          <Input type="time" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Duration (hours)</label>
        <Input type="number" step="0.5" min="0.5" value={durationHours} onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reason *</label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Overtime reason" required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Create Overtime'}</Button>
      </div>
    </form>
  );
}

export function AttendanceList() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modal state
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showOvertime, setShowOvertime] = useState(false);

  const companyId = localStorage.getItem('companyId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;

      const data = await attendanceService.getRecords(companyId, Object.keys(params).length ? params : undefined);
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter, dateFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      const result = await employeeService.getEmployees({ companyId, limit: 500 });
      setEmployees(result.data.map((e) => ({ id: e.id, fullName: e.fullName })));
    } catch {
      // silent
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
    fetchEmployees();
  }, [fetchData, fetchEmployees]);

  const filtered = records.filter(
    (r) => r.employee?.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;

  /* ---------- Handlers ---------- */

  const handleCheckIn = async (data: { employeeId: string; date: string; checkIn: string }) => {
    try {
      await attendanceService.createRecord(data);
      toast.success('Check-in recorded');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async (id: string) => {
    const now = new Date().toTimeString().slice(0, 5);
    try {
      await attendanceService.checkout(id, now);
      toast.success('Check-out recorded');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to check out');
    }
  };

  const handleOvertime = async (data: { employeeId: string; date: string; startTime: string; endTime: string; durationHours: number; reason: string }) => {
    try {
      await attendanceService.createOvertime(data);
      toast.success('Overtime created');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create overtime');
    }
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Track employee daily attendance"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowOvertime(true)}>
              <Clock9 size={16} className="mr-2" />
              Overtime
            </Button>
            <Button size="sm" onClick={() => setShowCheckIn(true)}>
              <LogIn size={16} className="mr-2" />
              Check In
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" /> Present
          </div>
          <p className="text-xl font-semibold">{present}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle size={14} className="text-amber-500" /> Late
          </div>
          <p className="text-xl font-semibold">{late}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <XCircle size={14} className="text-red-500" /> Absent
          </div>
          <p className="text-xl font-semibold">{absent}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground" />
        <div className="flex gap-1">
          {['', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employee</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Check In</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Check Out</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Notes</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Clock size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No attendance records</p>
                </div>
              </td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">{STATUS_ICONS[r.status]}</div>
                      <div>
                        <p className="text-sm font-medium">{r.employee?.fullName || '-'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.employee?.employeeNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.checkIn ? formatTime(r.checkIn) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.checkOut ? formatTime(r.checkOut) : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.notes || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {r.checkIn && !r.checkOut && (
                      <Button size="sm" variant="outline" onClick={() => handleCheckOut(r.id)}>
                        <LogOut size={14} className="mr-1" />
                        Check Out
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Check-In Modal */}
      <Modal open={showCheckIn} onClose={() => setShowCheckIn(false)} title="Check In">
        <CheckInForm
          employees={employees}
          onSave={handleCheckIn}
          onClose={() => setShowCheckIn(false)}
        />
      </Modal>

      {/* Overtime Modal */}
      <Modal open={showOvertime} onClose={() => setShowOvertime(false)} title="Create Overtime">
        <OvertimeForm
          employees={employees}
          onSave={handleOvertime}
          onClose={() => setShowOvertime(false)}
        />
      </Modal>
    </div>
  );
}
