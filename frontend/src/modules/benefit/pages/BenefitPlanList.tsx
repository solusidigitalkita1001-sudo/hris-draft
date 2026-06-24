import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { benefitService, type BenefitPlan } from '@/services/benefit.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Heart, Users } from 'lucide-react';

export function BenefitPlanList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await benefitService.getPlans(companyId);
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch benefit plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = plans.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Benefit Plans"
        description="Manage employee benefit programs and enrollments"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              Add Plan
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search plans..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Heart size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No benefit plans found</p>
            </div>
          </div>
        ) : (
          filtered.map((plan) => (
            <div
              key={plan.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/benefits/plans/${plan.id}`)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                  <Heart size={20} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{plan.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{plan.code}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  {plan.type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  plan.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                }`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{plan._count?.enrollments || 0} enrolled</span>
                </div>
                <span>
                  {plan.employeeContribution}% / {plan.employerContribution}%
                </span>
              </div>

              {plan.provider && (
                <p className="text-xs text-muted-foreground mt-2">
                  Provider: {plan.provider}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
