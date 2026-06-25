import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leaveService, type LeaveRequest } from '@/services/leave.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, CalendarDays, UserRound, FileText, CheckCircle2, XCircle,
  Clock,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/format';

export function LeaveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await leaveService.getRequest(id);
      setRequest(data);
    } catch (error) {
      console.error('Failed to fetch leave request:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      await leaveService.approveRequest(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading('reject');
    try {
      await leaveService.rejectRequest(id, rejectReason);
      await fetchData();
      setShowReject(false);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Leave request not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/leave')}>Back to Leave</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Leave Request Detail"
        description={`Status: ${request.status}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/leave')}>
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays size={14} /> Start Date
              </div>
              <p className="text-sm font-medium">{formatDate(request.startDate)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays size={14} /> End Date
              </div>
              <p className="text-sm font-medium">{formatDate(request.endDate)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock size={14} /> Total Days
              </div>
              <p className="text-sm font-medium">{request.totalDays} day(s)</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText size={14} /> Leave Type
              </div>
              <p className="text-sm font-medium">{request.leaveType?.name || '-'}</p>
            </div>
          </div>

          {/* Employee Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">Employee Information</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserRound size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{request.employee?.fullName || '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{request.employee?.employeeNumber}</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-2">Reason</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.reason}</p>
          </div>

          {/* Attachment */}
          {request.attachment && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Attachment</h3>
              <a href={request.attachment} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> View Document
              </a>
            </div>
          )}

          {/* Rejection Reason */}
          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 p-4">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Rejection Reason</h3>
              <p className="text-sm text-red-600 dark:text-red-400">{request.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Right - Actions & Timeline */}
        <div className="space-y-4">
          {/* Approve/Reject Actions */}
          {request.status === 'PENDING' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Actions</h3>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleApprove}
                  disabled={actionLoading === 'approve'}
                >
                  <CheckCircle2 size={16} className="mr-2" />
                  {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                </Button>

                {!showReject ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowReject(true)}
                  >
                    <XCircle size={16} className="mr-2" />
                    Reject
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">Reason for rejection:</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full h-20 text-xs p-2 rounded border border-border bg-background resize-none"
                      placeholder="Enter rejection reason..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'reject' || !rejectReason}>
                        {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectReason(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">Timeline</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={12} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium">Submitted</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</p>
                </div>
              </div>
              {request.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Approved</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(request.approvedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Leave Type Info */}
          {request.leaveType && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Leave Type Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{request.leaveType.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{request.leaveType.isPaid ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-mono text-xs">{request.leaveType.code}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
