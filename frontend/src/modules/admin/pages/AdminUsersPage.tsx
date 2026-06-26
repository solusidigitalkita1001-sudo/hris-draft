import { useState, useEffect, useCallback } from 'react';
import { userService, type UserData } from '@/services/user.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Plus, Shield, UserRound } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const companyId = localStorage.getItem('companyId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await userService.getAll(companyId));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.employee?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="User Management" description="Manage system users and their roles"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
          <Button size="sm"><Plus size={16} className="mr-2" />Add User</Button></>} />
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Roles</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            : filtered.length === 0
              ? <tr><td colSpan={5} className="text-center py-12"><Shield size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No users found</p></td></tr>
              : filtered.map((u) => (
                  <tr key={u.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserRound size={16} className="text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{u.employee?.fullName || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.userRoles?.map((ur) => (
                          <span key={ur.role.id} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">{ur.role.name}</span>
                        )) || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                  </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
