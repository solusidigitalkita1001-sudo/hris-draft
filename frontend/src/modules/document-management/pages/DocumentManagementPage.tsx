import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  documentManagementService,
  type DocumentCategory,
  type ManagedDocument,
} from '@/services/document-management.service';

type ExpiryFilter = 'ALL' | 'EXPIRING' | 'EXPIRED';

/** Check if a date string is within `days` from now. */
function isWithinDays(dateStr: string, days: number): boolean {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return target > now && target <= now + days * 24 * 60 * 60 * 1000;
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() <= Date.now();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function UploadDialog({
  open,
  categories,
  companyId,
  onClose,
  onUploaded,
}: {
  open: boolean;
  categories: DocumentCategory[];
  companyId: string;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerType, setOwnerType] = useState<'EMPLOYEE' | 'COMPANY' | 'GROUP'>('COMPANY');
  const [employeeId, setEmployeeId] = useState('');
  const [visibility, setVisibility] = useState<'INTERNAL' | 'RESTRICTED' | 'PUBLIC'>('INTERNAL');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(categories[0]?.id || '');
    setTitle('');
    setDescription('');
    setOwnerType('COMPANY');
    setEmployeeId('');
    setVisibility('INTERNAL');
    setExpiresAt('');
    setFile(null);
  }, [open, categories]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) {
      toast.error('companyId tidak tersedia');
      return;
    }
    if (!categoryId) {
      toast.error('Pilih kategori dokumen');
      return;
    }
    if (!title.trim()) {
      toast.error('Judul dokumen wajib diisi');
      return;
    }
    if (!file) {
      toast.error('File dokumen wajib dipilih');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }
    if (ownerType === 'EMPLOYEE' && !employeeId.trim()) {
      toast.error('employeeId wajib diisi untuk dokumen employee');
      return;
    }

    const expiresAtIso = expiresAt
      ? (() => {
          const parsed = new Date(expiresAt);
          if (Number.isNaN(parsed.getTime())) return null;
          if (parsed.getTime() <= Date.now()) return 'PAST';
          return parsed.toISOString();
        })()
      : undefined;

    if (expiresAt && expiresAtIso === null) {
      toast.error('Format expiresAt tidak valid');
      return;
    }

    if (expiresAtIso === 'PAST') {
      toast.error('expiresAt tidak boleh tanggal masa lalu');
      return;
    }

    try {
      setSubmitting(true);
      await documentManagementService.upload({
        companyId,
        categoryId,
        ownerType,
        employeeId: ownerType === 'EMPLOYEE' ? employeeId : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        expiresAt: expiresAtIso,
        file,
      });
      toast.success('Dokumen berhasil diupload');
      await onUploaded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Gagal upload dokumen');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Upload Dokumen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload dokumen company atau employee untuk modul DMS dasar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select2
                value={categoryId}
                onValueChange={setCategoryId}
                options={[
                  { value: '', label: 'Pilih kategori' },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
                placeholder="Pilih kategori"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Owner Type</label>
              <Select2
                value={ownerType}
                onValueChange={(value) => setOwnerType(value as 'EMPLOYEE' | 'COMPANY' | 'GROUP')}
                options={[
                  { value: 'COMPANY', label: 'Company' },
                  { value: 'EMPLOYEE', label: 'Employee' },
                  { value: 'GROUP', label: 'Group' },
                ]}
                placeholder="Pilih owner type"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Judul Dokumen</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Kontrak Kerja Bambang" />
          </div>

          {ownerType === 'EMPLOYEE' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee ID</label>
              <Input
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="Masukkan employeeId"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Deskripsi</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Catatan tambahan dokumen"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <Select2
                value={visibility}
                onValueChange={(value) => setVisibility(value as 'INTERNAL' | 'RESTRICTED' | 'PUBLIC')}
                options={[
                  { value: 'INTERNAL', label: 'Internal' },
                  { value: 'RESTRICTED', label: 'Restricted' },
                  { value: 'PUBLIC', label: 'Public' },
                ]}
                placeholder="Pilih visibility"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry Date</label>
              <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <Input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
  if (status === 'EXPIRED') return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400';
}

const expiryFilterTabs: { key: ExpiryFilter; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'EXPIRING', label: 'Akan Expired' },
  { key: 'EXPIRED', label: 'Expired' },
];

const EXPIRING_SOON_DAYS = 30;

export function DocumentManagementPage() {
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const companyId = localStorage.getItem('companyId') || '';

  const toggleExpand = (id: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setDocuments([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [fetchedCategories, fetchedDocuments] = await Promise.all([
        documentManagementService.getCategories(companyId),
        documentManagementService.getDocuments({
          companyId,
          search: search || undefined,
          categoryId: categoryId || undefined,
        }),
      ]);
      setCategories(fetchedCategories);
      setDocuments(fetchedDocuments);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data dokumen');
    } finally {
      setLoading(false);
    }
  }, [companyId, search, categoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDocuments = useMemo(() => {
    if (expiryFilter === 'ALL') return documents;

    return documents.filter((doc) => {
      if (!doc.expiresAt) return false;
      if (expiryFilter === 'EXPIRING') return isWithinDays(doc.expiresAt, EXPIRING_SOON_DAYS);
      if (expiryFilter === 'EXPIRED') return isExpired(doc.expiresAt);
      return true;
    });
  }, [documents, expiryFilter]);

  const summary = useMemo(() => {
    const active = documents.filter((item) => item.status === 'ACTIVE').length;
    const restricted = documents.filter((item) => item.visibility === 'RESTRICTED').length;
    const expiringSoon = documents.filter(
      (item) => item.expiresAt && isWithinDays(item.expiresAt, EXPIRING_SOON_DAYS),
    ).length;
    return { total: documents.length, active, restricted, expiringSoon };
  }, [documents]);

  const handleDownload = async (document: ManagedDocument) => {
    try {
      await documentManagementService.download(document.id, document.fileName);
    } catch (error) {
      console.error(error);
      toast.error('Gagal download dokumen');
    }
  };

  const renderExpiryBadge = (doc: ManagedDocument) => {
    if (!doc.expiresAt) return null;

    const expired = isExpired(doc.expiresAt);
    const expiring = isWithinDays(doc.expiresAt, EXPIRING_SOON_DAYS);

    if (expired) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-400">
          <AlertCircle size={12} />
          Expired {formatDate(doc.expiresAt)}
        </span>
      );
    }

    if (expiring) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          <AlertTriangle size={12} />
          Expiring {formatDate(doc.expiresAt)}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Clock size={12} />
        Expires {formatDate(doc.expiresAt)}
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Document Management"
        description="Repository dokumen dasar untuk company dan employee."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)} disabled={!companyId || categories.length === 0}>
              <Upload size={16} className="mr-2" />
              Upload
            </Button>
          </>
        }
      />

      {/* Summary Stat Cards */}
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Dokumen</p>
          <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dokumen Aktif</p>
          <p className="mt-2 text-2xl font-semibold">{summary.active}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Restricted</p>
          <p className="mt-2 text-2xl font-semibold">{summary.restricted}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Akan Expired</p>
          <p
            className={`mt-2 text-2xl font-semibold ${summary.expiringSoon > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}
          >
            {summary.expiringSoon > 0 ? (
              <span className="inline-flex items-center gap-2">
                {summary.expiringSoon}
                <AlertTriangle size={18} className="text-amber-500" />
              </span>
            ) : (
              summary.expiringSoon
            )}
          </p>
        </div>
      </div>

      {/* Expiry Filter Tabs + Search + Category Filter */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-1">
          {expiryFilterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setExpiryFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                expiryFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari judul, file, atau kategori"
              className="pl-9"
            />
          </div>
          <Select2
            value={categoryId}
            onValueChange={setCategoryId}
            options={[
              { value: '', label: 'Semua kategori' },
              ...categories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
            placeholder="Semua kategori"
            className="md:w-64"
          />
        </div>
      </div>

      {!companyId ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Company context belum tersedia. Pilih company aktif dulu sebelum membuka dokumen.
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Memuat dokumen...
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <FileText size={36} className="mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {expiryFilter !== 'ALL'
              ? `Tidak ada dokumen dengan status ${expiryFilter === 'EXPIRING' ? 'akan expired' : 'expired'}.`
              : 'Belum ada dokumen untuk company ini. Upload dokumen pertama untuk mulai menggunakan DMS.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => {
            const isExpanded = expandedDocs.has(document.id);
            return (
              <div
                key={document.id}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{document.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(document.status)}`}
                      >
                        {document.status}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {document.visibility}
                      </span>
                      {renderExpiryBadge(document)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {document.category.name} · {document.fileName} · v{document.version}
                    </p>
                    {document.employee && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Employee: {document.employee.fullName} ({document.employee.employeeNumber})
                      </p>
                    )}
                    {document.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{document.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Uploader: {document.uploader?.email || '-'} · Size: {(document.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(document.id)}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(document)}>
                      <Download size={16} className="mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* Version History — expandable section */}
                {isExpanded && (
                  <div className="mt-4 border-t border-border pt-3">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Version History
                    </h4>
                    <div className="space-y-2">
                      {Array.from({ length: document.version }, (_, i) => {
                        const verNum = i + 1;
                        const isCurrent = verNum === document.version;
                        return (
                          <div
                            key={verNum}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                              isCurrent
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border bg-muted/30'
                            }`}
                          >
                            <span className="font-medium">Version {verNum}</span>
                            <span className="text-xs text-muted-foreground">
                              {isCurrent ? 'Current' : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        categories={categories}
        companyId={companyId}
        onClose={() => setUploadOpen(false)}
        onUploaded={fetchData}
      />
    </div>
  );
}
