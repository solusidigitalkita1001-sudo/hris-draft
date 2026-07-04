import { useState, useEffect } from 'react';
import { Briefcase, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2, type Select2Option } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { employeeService, type EmployeeExperience } from '@/services/employee.service';
import { formatDate } from '@/utils/format';

interface ExperienceTabProps {
  employeeId: string;
}

const YES_NO_OPTIONS: Select2Option[] = [
  { value: 'true', label: 'Ya' },
  { value: 'false', label: 'Tidak' },
];

interface FormData {
  companyName: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrentPosition: string;
  jobDescription: string;
  achievements: string;
  industry: string;
  city: string;
  reasonForLeaving: string;
  referenceName: string;
  referencePhone: string;
}

const INITIAL_FORM_DATA: FormData = {
  companyName: '',
  position: '',
  startDate: '',
  endDate: '',
  isCurrentPosition: '',
  jobDescription: '',
  achievements: '',
  industry: '',
  city: '',
  reasonForLeaving: '',
  referenceName: '',
  referencePhone: '',
};

export default function ExperienceTab({ employeeId }: ExperienceTabProps) {
  const [data, setData] = useState<EmployeeExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeExperience | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM_DATA);

  const isCurrent = form.isCurrentPosition === 'true';

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  async function fetchData() {
    setLoading(true);
    try {
      const result = await employeeService.getExperiences(employeeId);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch experiences:', error);
      toast.error('Gagal memuat data pengalaman kerja');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
    setDialogOpen(true);
  }

  function handleOpenEdit(item: EmployeeExperience) {
    setEditingItem(item);
    setForm({
      companyName: item.companyName,
      position: item.position,
      startDate: item.startDate ? item.startDate.slice(0, 10) : '',
      endDate: item.endDate ? item.endDate.slice(0, 10) : '',
      isCurrentPosition: item.isCurrentPosition != null ? String(item.isCurrentPosition) : '',
      jobDescription: item.jobDescription || '',
      achievements: item.achievements || '',
      industry: item.industry || '',
      city: item.city || '',
      reasonForLeaving: item.reasonForLeaving || '',
      referenceName: item.referenceName || '',
      referencePhone: item.referencePhone || '',
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
    if (!form.companyName.trim()) {
      toast.error('Nama perusahaan harus diisi');
      return;
    }
    if (!form.position.trim()) {
      toast.error('Posisi/jabatan harus diisi');
      return;
    }
    if (!form.startDate) {
      toast.error('Tanggal mulai harus diisi');
      return;
    }

    setSaving(true);
    try {
      const isCurrentPosition = form.isCurrentPosition === 'true';

      const payload: Partial<EmployeeExperience> = {
        companyName: form.companyName.trim(),
        position: form.position.trim(),
        startDate: form.startDate,
        endDate: isCurrentPosition ? undefined : (form.endDate || undefined),
        isCurrentPosition,
        jobDescription: form.jobDescription.trim() || undefined,
        achievements: form.achievements.trim() || undefined,
        industry: form.industry.trim() || undefined,
        city: form.city.trim() || undefined,
        reasonForLeaving: isCurrentPosition ? undefined : (form.reasonForLeaving.trim() || undefined),
        referenceName: form.referenceName.trim() || undefined,
        referencePhone: form.referencePhone.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateExperience(employeeId, editingItem.id, payload);
        toast.success('Data pengalaman kerja berhasil diperbarui');
      } else {
        await employeeService.createExperience(employeeId, payload);
        toast.success('Data pengalaman kerja berhasil ditambahkan');
      }

      handleCloseDialog();
      await fetchData();
    } catch (error) {
      console.error('Failed to save experience:', error);
      toast.error('Gagal menyimpan data pengalaman kerja');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeExperience) {
    const confirmed = await popup.confirm({
      title: 'Hapus Experience',
      description: `Riwayat kerja di ${item.companyName} sebagai ${item.position} akan dihapus dari profil employee.`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteExperience(employeeId, item.id);
      toast.success('Data pengalaman kerja berhasil dihapus');
      await fetchData();
    } catch (error) {
      console.error('Failed to delete experience:', error);
      toast.error('Gagal menghapus data pengalaman kerja');
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
          <Briefcase size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">Pengalaman Kerja</h3>
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
              <Briefcase size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada data pengalaman kerja</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenAdd}>
              <Plus size={16} className="mr-1" />
              Tambah Pengalaman
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
                    <p className="font-medium text-foreground">{item.position}</p>
                    {item.isCurrentPosition && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.companyName}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(item.startDate)}</span>
                    <span>—</span>
                    <span>{item.isCurrentPosition ? 'Sekarang' : formatDate(item.endDate)}</span>
                    {item.city && <span>{item.city}</span>}
                  </div>
                  {item.jobDescription && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.jobDescription}</p>
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
                {editingItem ? 'Edit Pengalaman Kerja' : 'Tambah Pengalaman Kerja'}
              </h4>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog} disabled={saving}>
                &times;
              </Button>
            </div>

            {/* Dialog Body */}
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
              {/* companyName */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nama Perusahaan <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Nama perusahaan"
                />
              </div>

              {/* position */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Posisi / Jabatan <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                  placeholder="Posisi atau jabatan"
                />
              </div>

              {/* startDate / endDate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Tanggal Mulai <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                {!isCurrent && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Tanggal Selesai</label>
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {/* isCurrentPosition */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Posisi Saat Ini</label>
                <Select2
                  value={form.isCurrentPosition}
                  onValueChange={(value) => {
                    setForm((prev) => ({
                      ...prev,
                      isCurrentPosition: value,
                      endDate: value === 'true' ? '' : prev.endDate,
                    }));
                  }}
                  options={YES_NO_OPTIONS}
                  placeholder="Pilih"
                />
              </div>

              {/* jobDescription */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Deskripsi Pekerjaan</label>
                <textarea
                  value={form.jobDescription}
                  onChange={(e) => setForm((prev) => ({ ...prev, jobDescription: e.target.value }))}
                  placeholder="Deskripsi tanggung jawab pekerjaan"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* achievements */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Pencapaian</label>
                <textarea
                  value={form.achievements}
                  onChange={(e) => setForm((prev) => ({ ...prev, achievements: e.target.value }))}
                  placeholder="Pencapaian selama bekerja"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* industry / city */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Industri</label>
                  <Input
                    value={form.industry}
                    onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                    placeholder="Bidang industri"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Kota</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Kota"
                  />
                </div>
              </div>

              {/* reasonForLeaving */}
              {!isCurrent && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Alasan Keluar</label>
                  <textarea
                    value={form.reasonForLeaving}
                    onChange={(e) => setForm((prev) => ({ ...prev, reasonForLeaving: e.target.value }))}
                    placeholder="Alasan meninggalkan perusahaan"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

              {/* referenceName / referencePhone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Nama Referensi</label>
                  <Input
                    value={form.referenceName}
                    onChange={(e) => setForm((prev) => ({ ...prev, referenceName: e.target.value }))}
                    placeholder="Nama referensi"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Telepon Referensi</label>
                  <Input
                    value={form.referencePhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, referencePhone: e.target.value }))}
                    placeholder="Nomor telepon"
                  />
                </div>
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
