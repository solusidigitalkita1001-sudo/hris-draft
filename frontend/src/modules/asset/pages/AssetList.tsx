import { useState, useEffect, useCallback } from 'react';
import { assetService, type Asset } from '@/services/asset.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Plus, Package, UserRound } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import toast from 'react-hot-toast';

const STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ASSIGNED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  MAINTENANCE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  DISPOSED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

export function AssetList() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cid = localStorage.getItem('companyId') || '';
      setAssets(await assetService.getAll(cid));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.assetCode.toLowerCase().includes(search.toLowerCase()));
  const handleAddAsset = () => {
    toast('Form tambah asset belum tersedia. Saya bisa lanjut sambungkan create asset berikutnya.');
  };

  return (
    <div>
      <PageHeader title="Asset Management" description="Manage company assets & assignments"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
          <Button size="sm" onClick={handleAddAsset}><Plus size={16} className="mr-2" />Add Asset</Button></>} />
      <div className="relative mb-4 max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        : filtered.length === 0 ? <div className="col-span-full text-center py-12"><Package size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No assets found</p></div>
        : filtered.map((a) => (
          <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center"><Package size={20} className="text-muted-foreground" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{a.name}</p><p className="text-xs text-muted-foreground font-mono">{a.assetCode}</p></div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[a.status] || ''}`}>{a.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {a.currentValue && <span>{formatCurrency(Number(a.currentValue))}</span>}
              {a.assignments?.filter(as => !as.returnedAt).map(as => (
                <span key={as.id} className="flex items-center gap-1"><UserRound size={12} />{as.employee?.fullName}</span>
              ))}
            </div>
            {a.serialNumber && <p className="text-xs text-muted-foreground mt-2">SN: {a.serialNumber}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
