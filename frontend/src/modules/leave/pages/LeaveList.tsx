import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leaveService, type LeaveRequest } from '@/services/leave.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Plus, CalendarDays, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '@/utils/format';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-amber-500" />,
  APPROVED: <CheckCircle2 size={14} className="text-emerald-500" />,
  REJECTED: <XCircle size={14} className="text-red-500" />,
  CANCELLED: <AlertCircle size={14} className="text-gray-500" />,
  WITHDRAWN: <AlertCircle size={14} className="text-gray-500" />,
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  WITHDRAWN: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

// ─── Modal Wrapper ──────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

// ─── Confirm Dialog ─────────────────────────────────────
function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText, confirmClass }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
  confirmText?: string;
  confirmClass?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-base font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} className={confirmClass || ''}>{confirmText || 'Confirm'}</Button>
        </div>
      </div>
    </div>
  );
}

export function LeaveList() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Approve / Reject state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const reqData = await leaveService.getRequests(companyId, Object.keys(params).length ? params : undefined);
      setRequests(reqData);
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!approvingId) return;
    try {
      await leaveService.approveRequest(approvingId);
      toast.success('Leave request approved');
      setApprovingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await leaveService.rejectRequest(rejectingId, rejectReason || undefined);
      toast.success('Leave request rejected');
      setRejectingId(null);
      setRejectReason('');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject request');
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const filtered = requests.filter(
    (r) => r.employee?.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;

  return (
    <div>
      <PageHeader
        title="Leave Management"
        description="Manage employee leave requests"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              New Request
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock size={14} className="text-amber-500" /> Pending
          </div>
          <p className="text-xl font-semibold">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" /> Approved
          </div>
          <p className="text-xl font-semibold">{approvedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
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
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Leave Type</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Period</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Days</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Submitted</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <CalendarDays size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No leave requests</p>
                </div>
              </td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="table-row-hover cursor-pointer" onClick={() => navigate(`/leave/${r.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">{STATUS_ICONS[r.status]}</div>
                      <p className="text-sm font-medium">{r.employee?.fullName || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.leaveType?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(r.startDate)} - {formatDate(r.endDate)}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium">{r.totalDays}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.status === 'PENDING' && (
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => { e.stopPropagation(); setApprovingId(r.id); }}
                        >
                          <CheckCircle2 size={12} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                          onClick={(e) => { e.stopPropagation(); openRejectModal(r.id); }}
                        >
                          <XCircle size={12} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Confirm Dialog */}
      <ConfirmDialog
        open={!!approvingId}
        onClose={() => setApprovingId(null)}
        onConfirm={handleApprove}
        title="Approve Leave Request"
        message="Are you sure you want to approve this leave request?"
        confirmText="Approve"
        confirmClass="bg-emerald-600 hover:bg-emerald-700"
      />

      {/* Reject Modal */}
      <Modal open={!!rejectingId} onClose={() => setRejectingId(null)} title="Reject Leave Request">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Provide a reason for rejecting this leave request.
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rejection Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleReject}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
