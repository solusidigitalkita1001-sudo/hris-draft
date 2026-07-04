import { useState, useEffect } from 'react';
import { BookOpen, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2, type Select2Option } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { employeeService, type EmployeeTraining } from '@/services/employee.service';
import { formatDate } from '@/utils/format';

interface TrainingTabProps {
  employeeId: string;
}

const TRAINING_TYPE_OPTIONS: Select2Option[] = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'EXTERNAL', label: 'External' },
  { value: 'CERTIFICATION', label: 'Certification' },
  { value: 'SEMINAR', label: 'Seminar' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'OTHER', label: 'Lainnya' },
];

interface FormData {
  trainingName: string;
  organizer: string;
  trainingType: string;
  startDate: string;
  endDate: string;
  duration: string;
  description: string;
  certificateUrl: string;
  notes: string;
}

const INITIAL_FORM_DATA: FormData = {
  trainingName: '',
  organizer: '',
  trainingType: '',
  startDate: '',
  endDate: '',
  duration: '',
  description: '',
  certificateUrl: '',
  notes: '',
};

export default function TrainingTab({ employeeId }: TrainingTabProps) {
  const [data, setData] = useState<EmployeeTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeTraining | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  async function fetchData() {
    setLoading(true);
    try {
      const result = await employeeService.getTrainings(employeeId);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch trainings:', error);
      toast.error('Gagal memuat data pelatihan');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
    setDialogOpen(true);
  }

  function handleOpenEdit(item: EmployeeTraining) {
    setEditingItem(item);
    setForm({
      trainingName: item.trainingName,
      organizer: item.organizer || '',
      trainingType: item.trainingType || '',
      startDate: item.startDate ? item.startDate.slice(0, 10) : '',
      endDate: item.endDate ? item.endDate.slice(0, 10) : '',
      duration: item.duration || '',
      description: item.description || '',
      certificateUrl: item.certificateUrl || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saving) return;
    setDialogOpen(false);
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
  }

  async function handleSave() {
    if (!form.trainingName.trim()) {
      toast.error('Nama pelatihan harus diisi');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EmployeeTraining> = {
        trainingName: form.trainingName.trim(),
        organizer: form.organizer.trim() || undefined,
        trainingType: form.trainingType || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        duration: form.duration.trim() || undefined,
        description: form.description.trim() || undefined,
        certificateUrl: form.certificateUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateTraining(employeeId, editingItem.id, payload);
        toast.success('Data pelatihan berhasil diperbarui');
      } else {
        await employeeService.createTraining(employeeId, payload);
        toast.success('Data pelatihan berhasil ditambahkan');
      }

      handleCloseDialog();
      await fetchData();
    } catch (error) {
      console.error('Failed to save training:', error);
      toast.error('Gagal menyimpan data pelatihan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeTraining) {
    const confirmed = await popup.confirm({
      title: 'Hapus Training Record',
      description: `Riwayat pelatihan ${item.trainingName} akan dihapus dari profil employee.`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteTraining(employeeId, item.id);
      toast.success('Data pelatihan berhasil dihapus');
      await fetchData();
    } catch (error) {
      console.error('Failed to delete training:', error);
      toast.error('Gagal menghapus data pelatihan');
    }
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mb-4 rounded-lg border border-border p-4">
            <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">Riwayat Pelatihan</h3>
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus size={16} className="mr-1" />
          Tambah
        </Button>
      </div>

      {/* Content */}
      <div className="p-6">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada data pelatihan</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenAdd}>
              <Plus size={16} className="mr-1" />
              Tambah Pelatihan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{item.trainingName}</p>
                    {item.trainingType && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {TRAINING_TYPE_OPTIONS.find((o) => o.value === item.trainingType)?.label || item.trainingType}
                      </span>
                    )}
                  </div>
                  {item.organizer && (
                    <p className="text-sm text-muted-foreground">{item.organizer}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {item.startDate && (
                      <span>Mulai: {formatDate(item.startDate)}</span>
                    )}
                    {item.endDate && (
                      <span>Selesai: {formatDate(item.endDate)}</span>
                    )}
                    {item.duration && (
                      <span>Durasi: {item.duration}</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(item)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog Overlay */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h4 className="text-base font-semibold text-foreground">
                {editingItem ? 'Edit Pelatihan' : 'Tambah Pelatihan'}
              </h4>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog} disabled={saving}>
                &times;
              </Button>
            </div>

            {/* Dialog Body */}
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
              {/* trainingName */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nama Pelatihan <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.trainingName}
                  onChange={(e) => setForm((prev) => ({ ...prev, trainingName: e.target.value }))}
                  placeholder="Nama pelatihan"
                />
              </div>

              {/* organizer */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Penyelenggara</label>
                <Input
                  value={form.organizer}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizer: e.target.value }))}
                  placeholder="Nama penyelenggara"
                />
              </div>

              {/* trainingType */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Tipe Pelatihan</label>
                <Select2
                  value={form.trainingType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, trainingType: value }))}
                  options={TRAINING_TYPE_OPTIONS}
                  placeholder="Pilih tipe pelatihan"
                />
              </div>

              {/* startDate / endDate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tanggal Mulai</label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tanggal Selesai</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* duration */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Durasi</label>
                <Input
                  value={form.duration}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="Contoh: 2 hari, 3 bulan"
                />
              </div>

              {/* description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi pelatihan"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* certificateUrl */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">URL Sertifikat</label>
                <Input
                  value={form.certificateUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, certificateUrl: e.target.value }))}
                  placeholder="https://example.com/sertifikat"
                />
              </div>

              {/* notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan tambahan"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 size={16} className="mr-1 animate-spin" />}
                {editingItem ? 'Simpan' : 'Tambah'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
