import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditLogService, type AuditLogEntry } from '@/services/audit-log.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import { Search, RefreshCw, Download, FileText, UserRound, Globe, Eye } from 'lucide-react';
import { formatDateTime } from '@/utils/format';
import toast from 'react-hot-toast';

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  UPDATE: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  DELETE: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  LOGIN: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  LOGOUT: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  APPROVE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  REJECT: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  EXPORT: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
};

export function AdminAuditLogPage() {
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [entityId, setEntityId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const companyId = activeCompany?.id || '';

  const actionOptions = [
    { value: '', label: 'Semua Action' },
    { value: 'CREATE', label: 'CREATE' },
    { value: 'UPDATE', label: 'UPDATE' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'LOGIN', label: 'LOGIN' },
    { value: 'LOGOUT', label: 'LOGOUT' },
    { value: 'APPROVE', label: 'APPROVE' },
    { value: 'REJECT', label: 'REJECT' },
    { value: 'EXPORT', label: 'EXPORT' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditLogService.getAll({
        companyId: companyId || undefined,
        search: search.trim() || undefined,
        action: action || undefined,
        entity: entity.trim() || undefined,
        entityId: entityId.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 50,
      });
      setLogs(result.data);
      setTotalPages(result.meta.totalPages);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  }, [action, companyId, endDate, entity, entityId, ipAddress, page, search, startDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, action, entity, entityId, ipAddress, startDate, endDate, companyId]);

  const handleExport = async () => {
    try {
      const blob = await auditLogService.exportCsv({
        companyId: companyId || undefined,
        search: search.trim() || undefined,
        action: action || undefined,
        entity: entity.trim() || undefined,
        entityId: entityId.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([blob]));
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = 'audit-logs.csv';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error(error);
      toast.error('Gagal export audit log');
    }
  };

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Trail aktivitas sistem lengkap dengan filter lanjutan dan export."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative xl:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari action, entity, entity id, email, IP, payload..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select2 value={action} onValueChange={setAction} options={actionOptions} placeholder="Filter action" />
        <Input placeholder="Entity" value={entity} onChange={(e) => setEntity(e.target.value)} className="h-9" />
        <Input placeholder="Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} className="h-9" />
        <Input placeholder="IP Address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="h-9" />
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <FileText size={40} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Tidak ada audit log yang cocok dengan filter.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full">
              <thead className="table-header">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Time</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Entity</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Entity ID</th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">IP</th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id} className="table-row-hover text-sm">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserRound size={14} className="text-muted-foreground shrink-0" />
                        <span>{l.user?.email || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLES[l.action] || ''}`}>{l.action}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{l.entity}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{l.entityId ? l.entityId.slice(0, 8) + '...' : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Globe size={12} />
                        <span>{l.ipAddress || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/audit/${l.id}`)}>
                        <Eye size={14} className="mr-1.5" />
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
