import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  performanceService,
  type PerformanceResult,
} from '@/services/performance.service';
import { documentManagementService } from '@/services/document-management.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, MessageSquare, RefreshCw, Trophy } from 'lucide-react';

const RESULT_STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
  FINALIZED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
};

const DISPUTE_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  RESPONDED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  RESOLVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
  CLOSED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PerformanceMyResultsPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [results, setResults] = useState<PerformanceResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState('');
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [uploadingDisputeAttachment, setUploadingDisputeAttachment] = useState(false);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [disputeAttachmentFiles, setDisputeAttachmentFiles] = useState<Record<string, File | null>>({});
  const [disputeForm, setDisputeForm] = useState({
    title: '',
    message: '',
  });

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? null,
    [results, selectedResultId]
  );

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setResults([]);
      setSelectedResultId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getMyPublishedResults(companyId);
      setResults(data);
      setSelectedResultId((current) => (current && data.some((result) => result.id === current) ? current : data[0]?.id || ''));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memuat published result');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAcknowledge = useCallback(async () => {
    if (!selectedResult) {
      toast.error('Pilih result terlebih dahulu');
      return;
    }

    setAcknowledging(true);
    try {
      await performanceService.acknowledgePerformanceResult(selectedResult.id, {
        notes: acknowledgeNotes.trim() || undefined,
      });
      toast.success('Hasil performance berhasil di-acknowledge');
      setAcknowledgeNotes('');
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal acknowledge result');
    } finally {
      setAcknowledging(false);
    }
  }, [acknowledgeNotes, fetchData, selectedResult]);

  const handleCreateDispute = useCallback(async () => {
    if (!selectedResult) {
      toast.error('Pilih result terlebih dahulu');
      return;
    }

    if (!disputeForm.title.trim() || !disputeForm.message.trim()) {
      toast.error('Judul dan pesan dispute wajib diisi');
      return;
    }

    setSubmittingDispute(true);
    try {
      await performanceService.createPerformanceResultDispute(selectedResult.id, {
        title: disputeForm.title.trim(),
        message: disputeForm.message.trim(),
      });
      toast.success('Dispute berhasil dikirim');
      setDisputeForm({ title: '', message: '' });
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal mengirim dispute');
    } finally {
      setSubmittingDispute(false);
    }
  }, [disputeForm, fetchData, selectedResult]);

  const handleUploadDisputeAttachment = useCallback(async (disputeId: string) => {
    const file = disputeAttachmentFiles[disputeId];
    if (!file) {
      toast.error('Pilih file attachment');
      return;
    }

    setUploadingDisputeAttachment(true);
    try {
      await performanceService.uploadPerformanceDisputeAttachment(disputeId, {
        file,
        title: file.name,
        visibility: 'RESTRICTED',
      });
      setDisputeAttachmentFiles((prev) => ({ ...prev, [disputeId]: null }));
      toast.success('Attachment dispute berhasil diupload');
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal upload attachment dispute');
    } finally {
      setUploadingDisputeAttachment(false);
    }
  }, [disputeAttachmentFiles, fetchData]);

  const handleDownloadAttachment = useCallback(async (documentId: string, fileName: string) => {
    try {
      await documentManagementService.download(documentId, fileName);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal download attachment');
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="My Performance Results"
        description="Lihat hasil performance yang sudah dipublish, acknowledge hasil, dan ajukan dispute bila perlu."
        actions={(
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Published Results</h3>
              <p className="text-xs text-muted-foreground">Result yang sudah dibuka untuk employee sesuai visibility policy.</p>
            </div>
            <span className="text-xs text-muted-foreground">{results.length} item</span>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : !results.length ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada result yang dipublish.
              </div>
            ) : (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => setSelectedResultId(result.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    result.id === selectedResultId
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{result.period?.name || 'Tanpa period'}</p>
                      <p className="text-xs text-muted-foreground">{result.period?.code || '-'}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${RESULT_STATUS_STYLES[result.status] || RESULT_STATUS_STYLES.PUBLISHED}`}>
                      {result.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>Final Score: {result.finalScore ?? '-'}</p>
                    <p>Grade: {result.gradeLabel || '-'}</p>
                    <p>Published: {formatDateTime(result.publishedAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Result Detail</h3>
              <p className="text-xs text-muted-foreground">Detail score akan tampil sesuai visibility policy dari HR/manager.</p>
            </div>
            {!selectedResult ? (
              <p className="text-sm text-muted-foreground">Pilih result dari panel kiri.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedResult.period?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Final Score {selectedResult.finalScore ?? '-'} • Grade {selectedResult.gradeLabel || '-'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Published {formatDateTime(selectedResult.publishedAt)} • Dispute Deadline {formatDateTime(selectedResult.disputeDeadline)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <MiniStat label="Final Score" value={selectedResult.finalScore ?? '-'} icon={<Trophy size={16} />} />
                  <MiniStat label="Grade" value={selectedResult.gradeLabel || '-'} icon={<CheckCircle2 size={16} />} />
                  <MiniStat label="Disputes" value={selectedResult.disputes?.length || 0} icon={<AlertCircle size={16} />} />
                </div>

                {selectedResult.visibilityPolicy?.showRecommendations && (
                  <>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <p className="text-sm font-medium">Recommendation</p>
                      <p className="mt-2 text-sm text-muted-foreground">{selectedResult.recommendationSummary || 'Belum ada recommendation yang dipublish.'}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium">Development Recommendations</p>
                        <p className="text-xs text-muted-foreground">Course atau tindak lanjut development yang sudah ditautkan dari result performance.</p>
                      </div>
                      {!selectedResult.developmentRecommendations?.length ? (
                        <p className="text-sm text-muted-foreground">Belum ada development recommendation yang dipublish.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedResult.developmentRecommendations.map((recommendation) => (
                            <div key={recommendation.id} className="rounded-lg border border-border px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{recommendation.title}</p>
                                  <p className="text-xs text-muted-foreground">{recommendation.course?.title || recommendation.type}</p>
                                </div>
                                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                  {recommendation.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">{recommendation.description || recommendation.notes || '-'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Result Attachments</p>
                    <p className="text-xs text-muted-foreground">Dokumen resmi result yang disimpan ke document management.</p>
                  </div>
                  {!selectedResult.attachments?.length ? (
                    <p className="text-sm text-muted-foreground">Belum ada attachment result.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedResult.attachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border border-border px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{attachment.document.title}</p>
                              <p className="text-xs text-muted-foreground">{attachment.document.fileName}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedResult.visibilityPolicy?.showCalculation && (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-medium">Calculation Snapshot</p>
                    <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(selectedResult.calculationSnapshot || {}, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedResult.visibilityPolicy?.showCalibrationHistory && (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-medium">Calibration Snapshot</p>
                    <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(selectedResult.calibrationSnapshot || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedResult && (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Acknowledge Result</h3>
                  <p className="text-xs text-muted-foreground">Konfirmasi bahwa hasil performance sudah dibaca.</p>
                </div>
                <div className="space-y-3">
                  <Input
                    value={acknowledgeNotes}
                    onChange={(event) => setAcknowledgeNotes(event.target.value)}
                    placeholder="Catatan acknowledge"
                  />
                  <Button size="sm" className="w-full" onClick={() => void handleAcknowledge()} disabled={acknowledging || Boolean(selectedResult.acknowledgedAt)}>
                    <CheckCircle2 size={16} className="mr-2" />
                    {selectedResult.acknowledgedAt ? 'Sudah Acknowledged' : acknowledging ? 'Menyimpan...' : 'Acknowledge Result'}
                  </Button>
                  {selectedResult.acknowledgedAt && (
                    <p className="text-xs text-muted-foreground">
                      Di-acknowledge pada {formatDateTime(selectedResult.acknowledgedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Dispute Result</h3>
                  <p className="text-xs text-muted-foreground">Ajukan dispute jika ada keberatan terhadap hasil final yang dipublish.</p>
                </div>
                <div className="space-y-3">
                  <Input
                    value={disputeForm.title}
                    onChange={(event) => setDisputeForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Judul dispute"
                  />
                  <textarea
                    value={disputeForm.message}
                    onChange={(event) => setDisputeForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Jelaskan dispute Anda"
                    className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button size="sm" className="w-full" onClick={() => void handleCreateDispute()} disabled={submittingDispute}>
                    <MessageSquare size={16} className="mr-2" />
                    {submittingDispute ? 'Mengirim...' : 'Kirim Dispute'}
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {(selectedResult.disputes || []).map((dispute) => (
                    <div key={dispute.id} className="rounded-lg border border-border px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{dispute.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{dispute.message}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${DISPUTE_STATUS_STYLES[dispute.status] || DISPUTE_STATUS_STYLES.OPEN}`}>
                          {dispute.status}
                        </span>
                      </div>
                      {dispute.responseMessage && (
                        <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
                          <p className="text-xs font-medium">Response</p>
                          <p className="mt-1 text-xs text-muted-foreground">{dispute.responseMessage}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {dispute.respondedBy?.fullName || '-'} • {formatDateTime(dispute.respondedAt)}
                          </p>
                        </div>
                      )}
                      <div className="mt-3 rounded-lg border border-border px-3 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Attachment Evidence</p>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="file"
                            className="block w-full text-sm"
                            onChange={(event) => setDisputeAttachmentFiles((prev) => ({ ...prev, [dispute.id]: event.target.files?.[0] || null }))}
                          />
                          <Button size="sm" variant="outline" onClick={() => void handleUploadDisputeAttachment(dispute.id)} disabled={uploadingDisputeAttachment}>
                            {uploadingDisputeAttachment ? 'Uploading...' : 'Upload'}
                          </Button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {!dispute.attachments?.length ? (
                            <p className="text-xs text-muted-foreground">Belum ada attachment dispute.</p>
                          ) : dispute.attachments.map((attachment) => (
                            <div key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{attachment.document.title}</p>
                                  <p className="text-xs text-muted-foreground">{attachment.document.fileName}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                                  Download
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
