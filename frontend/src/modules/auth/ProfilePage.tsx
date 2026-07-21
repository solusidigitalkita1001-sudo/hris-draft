import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { authService, type AuthUser, type UserSession } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';
import { RefreshCw, ShieldCheck, UserCircle2, KeyRound, Building2, IdCard } from 'lucide-react';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function ProfilePage() {
  const { setUser } = useAuthStore();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [profileData, sessionData] = await Promise.all([
        authService.getProfile(),
        authService.getSessions(),
      ]);
      setProfile(profileData);
      setUser(profileData);
      setSessions(sessionData);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal memuat profil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await authService.revokeSession(sessionId);
      toast.success('Session berhasil dicabut');
      await loadData(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal mencabut session');
    } finally {
      setRevokingId(null);
    }
  }, [loadData]);

  if (loading) {
    return <div className="py-12 text-sm text-muted-foreground">Memuat profil...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Saya"
        description="Ringkasan akun, akses, dan session aktif."
        actions={(
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCircle2 size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold">{profile?.name || profile?.email || 'User'}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <InfoRow label="Nama" value={profile?.name || '-'} />
          <InfoRow label="Email" value={profile?.email || '-'} />
          <InfoRow label="Employee ID" value={profile?.employeeId || '-'} />
          <InfoRow label="Company ID" value={profile?.companyId || '-'} />
          <InfoRow label="Group ID" value={profile?.groupId || '-'} />
          <InfoRow
            label="Harus ganti password"
            value={profile?.mustChangePassword ? 'Ya' : 'Tidak'}
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="text-base font-semibold">Akses</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <IdCard size={15} className="text-muted-foreground" />
                Role
              </div>
              <div className="flex flex-wrap gap-2">
                {profile?.roles?.length ? profile.roles.map((role) => (
                  <span key={role} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {role}
                  </span>
                )) : <span className="text-sm text-muted-foreground">-</span>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Building2 size={15} className="text-muted-foreground" />
                Company Scope
              </div>
              <div className="flex flex-wrap gap-2">
                {profile?.companyScope?.length ? profile.companyScope.map((companyId) => (
                  <span key={companyId} className="rounded-full border border-border px-2.5 py-1 text-xs">
                    {companyId}
                  </span>
                )) : <span className="text-sm text-muted-foreground">-</span>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <KeyRound size={15} className="text-muted-foreground" />
                Permission
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                {profile?.permissions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.permissions.map((permission) => (
                      <code key={permission} className="rounded bg-background px-2 py-1">
                        {permission}
                      </code>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Tidak ada permission.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Session Aktif</h2>
            <p className="text-sm text-muted-foreground">Daftar refresh session yang masih aktif untuk akun ini.</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {sessions.length} session
          </span>
        </div>

        {!sessions.length ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            Belum ada session aktif yang tercatat.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium break-all">{session.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-muted-foreground">IP: {session.ipAddress || '-'}</p>
                  <p className="text-xs text-muted-foreground">Dibuat: {new Date(session.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Expired: {new Date(session.expiresAt).toLocaleString()}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revokingId === session.id}
                  onClick={() => handleRevokeSession(session.id)}
                >
                  {revokingId === session.id ? 'Mencabut...' : 'Cabut Session'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
