import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { employeeService, type EmployeeEducation } from '@/services/employee.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { formatDate } from '@/utils/format';
import { GraduationCap, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';

const EDUCATION_LEVELS = [
  { value: 'SD', label: 'SD' },
  { value: 'SMP', label: 'SMP' },
  { value: 'SMA', label: 'SMA' },
  { value: 'D1', label: 'D1' },
  { value: 'D2', label: 'D2' },
  { value: 'D3', label: 'D3' },
  { value: 'S1', label: 'S1' },
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Ya' },
  { value: 'false', label: 'Tidak' },
];

interface EducationForm {
  level: string;
  institutionName: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  isGraduated: string;
  gpa: string;
  city: string;
  notes: string;
}

const EMPTY_FORM: EducationForm = {
  level: '',
  institutionName: '',
  major: '',
  degree: '',
  startDate: '',
  endDate: '',
  isGraduated: 'true',
  gpa: '',
  city: '',
  notes: '',
};

interface EducationTabProps {
  employeeId: string;
}

export function EducationTab({ employeeId }: EducationTabProps) {
  const [educations, setEducations] = useState<EmployeeEducation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeEducation | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EducationForm>(EMPTY_FORM);

  const fetchEducations = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEducations(employeeId);
      setEducations(data);
    } catch (error) {
      console.error('Failed to fetch educations:', error);
      toast.error('Gagal memuat data pendidikan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducations();
  }, [employeeId]);

  const openAddDialog = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: EmployeeEducation) => {
    setEditingItem(item);
    setForm({
      level: item.level || '',
      institutionName: item.institutionName || '',
      major: item.major || '',
      degree: item.degree || '',
      startDate: item.startDate ? item.startDate.split('T')[0] : '',
      endDate: item.endDate ? item.endDate.split('T')[0] : '',
      isGraduated: item.isGraduated != null ? String(item.isGraduated) : 'true',
      gpa: item.gpa != null ? String(item.gpa) : '',
      city: item.city || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.level || !form.institutionName) {
      toast.error('Level dan Institution Name harus diisi');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EmployeeEducation> = {
        level: form.level,
        institutionName: form.institutionName,
        major: form.major || undefined,
        degree: form.degree || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        isGraduated: form.isGraduated === 'true',
        gpa: form.gpa ? parseFloat(form.gpa) : undefined,
        city: form.city || undefined,
        notes: form.notes || undefined,
      };

      if (editingItem) {
        await employeeService.updateEducation(employeeId, editingItem.id, payload);
        toast.success('Data pendidikan berhasil diperbarui');
      } else {
        await employeeService.createEducation(employeeId, payload);
        toast.success('Data pendidikan berhasil ditambahkan');
      }

      closeDialog();
      await fetchEducations();
    } catch (error) {
      console.error('Failed to save education:', error);
      toast.error('Gagal menyimpan data pendidikan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: EmployeeEducation) => {
    const confirmed = await popup.confirm({
      title: 'Hapus Data Pendidikan',
      description: `Riwayat pendidikan ${item.institutionName} (${item.level}) akan dihapus dari profil employee.`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteEducation(employeeId, item.id);
      toast.success('Data pendidikan berhasil dihapus');
      await fetchEducations();
    } catch (error) {
      console.error('Failed to delete education:', error);
      toast.error('Gagal menghapus data pendidikan');
    }
  };

  const updateForm = (field: keyof EducationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-6">
        <div className="mb-6 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">Education</h3>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus size={16} className="mr-2" />
          Tambah
        </Button>
      </div>

      {/* Body */}
      <div className="p-6">
        {educations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center">
            <GraduationCap size={40} className="mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada data pendidikan</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Klik tombol Tambah untuk menambahkan riwayat pendidikan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {educations.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{item.institutionName}</h4>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                        {item.level}
                      </span>
                    </div>
                    {item.major && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.major}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {item.startDate && (
                        <span>{formatDate(item.startDate)}</span>
                      )}
                      {item.startDate && item.endDate && (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                      {item.endDate && (
                        <span>{formatDate(item.endDate)}</span>
                      )}
                      {item.isGraduated != null && (
                        <span
                          className={
                            item.isGraduated
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {item.isGraduated ? 'Lulus' : 'Tidak Lulus'}
                        </span>
                      )}
                      {item.gpa != null && (
                        <span>IPK: {item.gpa.toFixed(2)}</span>
                      )}
                    </div>
                    {item.city && (
                      <p className="mt-1 text-xs text-muted-foreground/60">{item.city}</p>
                    )}
                    {item.notes && (
                      <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                    {item.degree && (
                      <p className="mt-1 text-xs text-muted-foreground/60">Gelar: {item.degree}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(item)}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog / Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDialog}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {editingItem ? 'Edit' : 'Tambah'} Pendidikan
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {editingItem ? 'Edit Data Pendidikan' : 'Tambah Data Pendidikan'}
                </h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={closeDialog} disabled={saving}>
                Tutup
              </Button>
            </div>

            {/* Dialog Form */}
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Level */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Level <span className="text-destructive">*</span>
                  </label>
                  <Select2
                    value={form.level}
                    onValueChange={(value) => updateForm('level', value)}
                    options={EDUCATION_LEVELS}
                    placeholder="Pilih level"
                  />
                </div>

                {/* Institution Name */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Institution Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.institutionName}
                    onChange={(e) => updateForm('institutionName', e.target.value)}
                    placeholder="Nama institusi/universitas"
                    className="h-10"
                  />
                </div>

                {/* Major */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Major</label>
                  <Input
                    value={form.major}
                    onChange={(e) => updateForm('major', e.target.value)}
                    placeholder="Jurusan"
                    className="h-10"
                  />
                </div>

                {/* Degree */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Degree</label>
                  <Input
                    value={form.degree}
                    onChange={(e) => updateForm('degree', e.target.value)}
                    placeholder="Gelar akademik (misal: S.Kom)"
                    className="h-10"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm('startDate', e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateForm('endDate', e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Is Graduated */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Lulus?</label>
                  <Select2
                    value={form.isGraduated}
                    onValueChange={(value) => updateForm('isGraduated', value)}
                    options={YES_NO_OPTIONS}
                    placeholder="Pilih"
                  />
                </div>

                {/* GPA */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">GPA</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={form.gpa}
                    onChange={(e) => updateForm('gpa', e.target.value)}
                    placeholder="IPK"
                    className="h-10"
                  />
                </div>

                {/* City */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
                  <Input
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    placeholder="Kota lokasi institusi"
                    className="h-10"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateForm('notes', e.target.value)}
                    className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Catatan tambahan"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <GraduationCap size={16} className="mr-2" />
                  )}
                  {saving ? 'Menyimpan...' : editingItem ? 'Perbarui' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
