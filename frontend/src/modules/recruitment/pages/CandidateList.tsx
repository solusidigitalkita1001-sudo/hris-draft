import { useState, useEffect, useCallback } from 'react';
import { recruitmentService, type Candidate } from '@/services/recruitment.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { Plus, Search, RefreshCw, UserRound, Mail, Phone, Briefcase, Building2 } from 'lucide-react';
//

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  HIRED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  WITHDRAWN: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  BLACKLISTED: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.ACTIVE
      }`}
    >
      {status}
    </span>
  );
}

export function CandidateList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await recruitmentService.getCandidates(companyId);
      setCandidates(data);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = candidates.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.currentPosition?.toLowerCase().includes(search.toLowerCase()) ||
      c.currentCompany?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddCandidate = () => {
    toast('Form tambah candidate belum tersedia. Route create candidate belum disambungkan.');
  };

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Manage candidate profiles and talent pool"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleAddCandidate}>
              <Plus size={16} className="mr-2" />
              Add Candidate
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search candidates by name, email, position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <UserRound size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No candidates found</p>
              <p className="text-xs text-muted-foreground">
                Add candidates or import from applications
              </p>
            </div>
          </div>
        ) : (
          filtered.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {candidate.firstName[0]}
                    {candidate.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {candidate.firstName} {candidate.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={candidate.status} />
                    {candidate.source && (
                      <span className="text-xs text-muted-foreground">
                        via {candidate.source}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(candidate.currentPosition || candidate.currentCompany) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  {candidate.currentPosition && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {candidate.currentPosition}
                    </span>
                  )}
                  {candidate.currentCompany && (
                    <span className="flex items-center gap-1">
                      <Building2 size={12} />
                      {candidate.currentCompany}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-1 text-xs text-muted-foreground">
                {candidate.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} />
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} />
                    {candidate.phone}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
