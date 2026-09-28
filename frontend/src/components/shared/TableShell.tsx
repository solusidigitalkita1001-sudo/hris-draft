import { useMemo, useState, type ReactNode } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/provider';

/**
 * Cangkang tabel ala DataTable handoff: kartu radius 22 dengan header
 * "Tampilkan N entri" + pencarian, body ber-overflow-x, dan footer paginasi.
 * Data di halaman ini dimuat sekali dari server lalu difilter/dipaginasi
 * di client (kontrak service existing mengembalikan list penuh).
 */
// eslint-disable-next-line react-refresh/only-export-components -- hook pengendali tabel sengaja co-located dengan shell-nya
export function useTableControls<T>(items: T[], matcher: (item: T, query: string) => boolean) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => matcher(item, q));
    // matcher sengaja closure per-render; filter murah untuk list self-service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    search,
    setSearch: (value: string) => { setSearch(value); setPage(1); },
    pageSize,
    setPageSize: (value: number) => { setPageSize(value); setPage(1); },
    page: safePage,
    setPage,
    totalPages,
    filtered,
    paged,
  };
}

function pageWindow(current: number, total: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export function TableShell({
  search,
  setSearch,
  pageSize,
  setPageSize,
  page,
  setPage,
  totalPages,
  totalItems,
  searchPlaceholder,
  headerExtra,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  page: number;
  setPage: (value: number) => void;
  totalPages: number;
  totalItems: number;
  searchPlaceholder?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('adm.table.searchPlaceholder');
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);

  return (
    <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          {t('adm.table.show')}
          <span className="relative inline-flex items-center">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="appearance-none rounded-[10px] border border-border bg-card py-1.5 pl-3 pr-7 text-[11.5px] font-medium text-foreground"
              aria-label={t('adm.table.pageSizeAria')}
            >
              {[5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
          </span>
          {t('adm.table.entries')}
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[200px] items-center gap-2 rounded-[12px] border border-border bg-background px-3 py-2">
            <Search size={14} className="flex-none text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={resolvedSearchPlaceholder}
              className="w-full bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground"
              aria-label={resolvedSearchPlaceholder}
            />
          </div>
          {headerExtra}
        </div>
      </div>

      <div className="overflow-x-auto">{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <span className="text-[11.5px] text-muted-foreground">
          {t('adm.table.showingRange', { from, to, total: totalItems })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="h-8 rounded-[10px] border border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('adm.table.previous')}
          </button>
          {pageWindow(page, totalPages).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`h-8 min-w-[32px] rounded-[10px] border px-1 text-[11.5px] font-medium transition-colors ${
                n === page
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="h-8 rounded-[10px] border border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('adm.table.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
