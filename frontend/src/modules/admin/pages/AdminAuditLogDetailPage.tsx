import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { auditLogService, type AuditLogEntry } from '@/services/audit-log.service';
import { ArrowLeft, Building2, Clock3, Globe, RefreshCw, UserRound } from 'lucide-react';
import { formatDateTime } from '@/utils/format';
import toast from 'react-hot-toast';

function parseAuditPayload(value?: string) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function JsonBlock({ title, value }: { title: string; value?: string }) {
  const parsed = useMemo(() => parseAuditPayload(value), [value]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {parsed === null ? (
        <p className="text-sm text-muted-foreground">Tidak ada data.</p>
      ) : typeof parsed === 'string' ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">{parsed}</pre>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AdminAuditLogDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [log, setLog] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await auditLogService.get(id);
      setLog(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat detail audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [id]);

  return (
    <div>
      <PageHeader
        title="Audit Log Detail"
        description="Detail lengkap perubahan dan metadata aktivitas sistem."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit')}>
              <ArrowLeft size={16} className="mr-2" />
              Kembali
            </Button>
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : !log ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Audit log tidak ditemukan.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Action</p>
              <p className="mt-2 text-lg font-semibold">{log.action}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Entity</p>
              <p className="mt-2 text-lg font-semibold">{log.entity}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Entity ID</p>
              <p className="mt-2 break-all font-mono text-sm">{log.entityId || '-'}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="mt-2 text-sm font-medium">{formatDateTime(log.createdAt)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Metadata</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <UserRound size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide">User</p>
                    <p className="text-foreground">{log.user?.email || 'System'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Building2 size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide">Company</p>
                    <p className="text-foreground">{log.company?.name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Globe size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide">IP Address</p>
                    <p className="text-foreground">{log.ipAddress || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Clock3 size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide">User Agent</p>
                    <p className="break-words text-foreground">{log.userAgent || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Identifiers</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Audit Log ID</p>
                  <p className="mt-1 break-all font-mono text-foreground">{log.id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">User ID</p>
                  <p className="mt-1 break-all font-mono text-foreground">{log.userId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Company ID</p>
                  <p className="mt-1 break-all font-mono text-foreground">{log.companyId || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <JsonBlock title="Old Value" value={log.oldValue} />
            <JsonBlock title="New Value" value={log.newValue} />
          </div>
        </div>
      )}
    </div>
  );
}
