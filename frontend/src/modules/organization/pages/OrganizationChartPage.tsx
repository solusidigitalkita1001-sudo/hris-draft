import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Network,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { employeeService, type Employee } from '@/services/employee.service';
import {
  organizationService,
  type Company,
  type Department,
  type Division,
  type Position,
} from '@/services/organization.service';

type OrgNodeType = 'company' | 'division' | 'department' | 'position';

interface OrgChartNode {
  id: string;
  type: OrgNodeType;
  label: string;
  subtitle?: string;
  status?: string;
  headName?: string;
  employeeCount?: number;
  children: OrgChartNode[];
}

const NODE_STYLES: Record<OrgNodeType, string> = {
  company: 'border-rose-200 bg-gradient-to-b from-rose-50 to-white text-rose-950 shadow-rose-900/10 dark:border-rose-900 dark:from-rose-950/40 dark:to-slate-950 dark:text-rose-100',
  division: 'border-sky-200 bg-gradient-to-b from-sky-50 to-white text-sky-950 shadow-sky-900/10 dark:border-sky-900 dark:from-sky-950/40 dark:to-slate-950 dark:text-sky-100',
  department: 'border-emerald-200 bg-gradient-to-b from-emerald-50 to-white text-emerald-950 shadow-emerald-900/10 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-950 dark:text-emerald-100',
  position: 'border-violet-200 bg-gradient-to-b from-violet-50 to-white text-violet-950 shadow-violet-900/10 dark:border-violet-900 dark:from-violet-950/40 dark:to-slate-950 dark:text-violet-100',
};

const NODE_ICON_STYLES: Record<OrgNodeType, string> = {
  company: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200',
  division: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200',
  department: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200',
  position: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200',
};

const CONNECTOR_CLASS = 'bg-slate-300 dark:bg-slate-600';

const DETAIL_LABELS: Record<OrgNodeType, string> = {
  company: 'Company',
  division: 'Division',
  department: 'Department',
  position: 'Position',
};

function normalizeNodeLabel(value: string) {
  return value.trim().toLowerCase();
}

function filterTree(node: OrgChartNode, query: string): OrgChartNode | null {
  if (!query) return node;

  const needle = normalizeNodeLabel(query);
  const ownMatch =
    normalizeNodeLabel(node.label).includes(needle) ||
    normalizeNodeLabel(node.subtitle || '').includes(needle) ||
    normalizeNodeLabel(node.headName || '').includes(needle);

  const filteredChildren = node.children
    .map((child) => filterTree(child, query))
    .filter((child): child is OrgChartNode => Boolean(child));

  if (!ownMatch && filteredChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
  };
}

function findNodeById(node: OrgChartNode, targetId: string): OrgChartNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const match = findNodeById(child, targetId);
    if (match) return match;
  }
  return null;
}

function collectExpandableIds(node: OrgChartNode, ids: Set<string>) {
  if (node.children.length > 0) {
    ids.add(node.id);
  }
  node.children.forEach((child) => collectExpandableIds(child, ids));
}

function formatCountLabel(count: number | undefined, singular: string, plural = `${singular}s`) {
  if (!count) return `0 ${plural}`;
  return `${count} ${count === 1 ? singular : plural}`;
}

function flattenDepartments(departments: Department[]): Department[] {
  const visited = new Set<string>();
  const result: Department[] = [];

  const walk = (items: Department[]) => {
    items.forEach((item) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);
      result.push(item);
      walk(item.children || []);
      walk(item.subDepartments || []);
    });
  };

  walk(departments);
  return result;
}

function buildDepartmentNode(department: Department, positionsByDepartment: Map<string, Position[]>): OrgChartNode {
  const nestedDepartments = [
    ...(department.children || []),
    ...(department.subDepartments || []),
  ];

  const uniqueDepartments = Array.from(new Map(nestedDepartments.map((item) => [item.id, item])).values());
  const departmentChildren = uniqueDepartments.map((child) => buildDepartmentNode(child, positionsByDepartment));
  const positionChildren = (positionsByDepartment.get(department.id) || []).map<OrgChartNode>((position) => ({
    id: position.id,
    type: 'position',
    label: position.name,
    subtitle: `${position.code}${position.gradeLevel ? ` • Grade ${position.gradeLevel}` : ''}`,
    status: position.status,
    employeeCount: position._count?.employees || 0,
    children: [],
  }));

  return {
    id: department.id,
    type: 'department',
    label: department.name,
    subtitle: department.code,
    status: department.status,
    headName: department.head?.fullName,
    children: [...departmentChildren, ...positionChildren],
  };
}

function buildOrgChartTree(
  company: Company,
  divisions: Division[],
  hierarchy: Department[],
  positions: Position[]
): OrgChartNode {
  const positionsByDepartment = new Map<string, Position[]>();

  positions.forEach((position) => {
    if (!position.departmentId) return;
    const existing = positionsByDepartment.get(position.departmentId) || [];
    existing.push(position);
    positionsByDepartment.set(position.departmentId, existing);
  });

  const departmentsByDivision = new Map<string, Department[]>();
  const rootDepartments: Department[] = [];

  hierarchy.forEach((department) => {
    if (department.divisionId) {
      const existing = departmentsByDivision.get(department.divisionId) || [];
      existing.push(department);
      departmentsByDivision.set(department.divisionId, existing);
      return;
    }
    rootDepartments.push(department);
  });

  const divisionNodes = divisions.map<OrgChartNode>((division) => ({
    id: division.id,
    type: 'division',
    label: division.name,
    subtitle: division.code,
    status: division.status,
    headName: division.head?.fullName,
    children: (departmentsByDivision.get(division.id) || []).map((department) =>
      buildDepartmentNode(department, positionsByDepartment)
    ),
  }));

  const orphanDepartmentNodes = rootDepartments.map((department) =>
    buildDepartmentNode(department, positionsByDepartment)
  );

  return {
    id: company.id,
    type: 'company',
    label: company.name,
    subtitle: `${company.code} • ${company.group?.name || 'No Group'}`,
    status: company.status,
    employeeCount: company._count?.employees || 0,
    children: [...divisionNodes, ...orphanDepartmentNodes],
  };
}

function NodeCard({
  node,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  node: OrgChartNode;
  selected: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: OrgChartNode) => void;
}) {
  const Icon =
    node.type === 'company'
      ? Building2
      : node.type === 'division'
        ? GitBranch
        : node.type === 'department'
          ? Network
          : Briefcase;

  return (
    <div
      className={[
        'group min-w-[180px] max-w-[220px] rounded-xl border px-4 py-3 text-left shadow-lg transition-all',
        NODE_STYLES[node.type],
        selected
          ? 'ring-4 ring-primary/20 ring-offset-2 ring-offset-background scale-[1.02]'
          : 'hover:-translate-y-0.5 hover:shadow-xl',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onSelect(node)} className="w-full text-left">
            <div className="flex items-center gap-2">
              <span className={`rounded-md p-1 ${NODE_ICON_STYLES[node.type]}`}>
                <Icon size={14} className="shrink-0" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                {DETAIL_LABELS[node.type]}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold">{node.label}</p>
            {node.subtitle && (
              <p className="mt-1 line-clamp-2 text-xs opacity-75">{node.subtitle}</p>
            )}
            {node.headName && (
              <p className="mt-2 text-xs opacity-80">Lead: {node.headName}</p>
            )}
            {typeof node.employeeCount === 'number' && (
              <p className="mt-1 text-xs opacity-80">{formatCountLabel(node.employeeCount, 'person', 'people')}</p>
            )}
          </button>
        </div>

        {node.children.length > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
            className="rounded-md border border-black/10 bg-black/5 p-1 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            aria-label={expanded ? 'Collapse node' : 'Expand node'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  selectedNodeId,
  collapsedIds,
  onToggle,
  onSelect,
}: {
  node: OrgChartNode;
  selectedNodeId: string | null;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: OrgChartNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && !collapsedIds.has(node.id);

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        selected={selectedNodeId === node.id}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onSelect}
      />

      {hasChildren && expanded && (
        <div className="mt-4 flex flex-col items-center">
          <div className={`h-6 w-0.5 ${CONNECTOR_CLASS}`} />
          <div className="relative flex flex-wrap justify-center gap-x-5 gap-y-8 pt-5">
            {node.children.length > 1 && (
              <div className={`absolute left-10 right-10 top-0 h-0.5 ${CONNECTOR_CLASS}`} />
            )}

            {node.children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center pt-5">
                <div className={`absolute top-0 h-5 w-0.5 ${CONNECTOR_CLASS}`} />
                <TreeNode
                  node={child}
                  selectedNodeId={selectedNodeId}
                  collapsedIds={collapsedIds}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleDialog({
  open,
  node,
  loading,
  employees,
  total,
  onClose,
}: {
  open: boolean;
  node: OrgChartNode | null;
  loading: boolean;
  employees: Employee[];
  total: number;
  onClose: () => void;
}) {
  if (!open || !node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              People In {DETAIL_LABELS[node.type]}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{node.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? 'Memuat data orang...' : `${total} orang terkait node ini`}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Memuat daftar orang...</div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Belum ada orang yang terhubung ke node ini.
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{employee.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {employee.employeeNumber} {employee.email ? `• ${employee.email}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {employee.department?.name || '-'} • {employee.position?.name || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      {employee.employmentStatus}
                    </span>
                    <p className="mt-2 text-xs text-muted-foreground">{employee.employmentType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrganizationChartPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [hierarchy, setHierarchy] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [peopleDialogOpen, setPeopleDialogOpen] = useState(false);
  const [peopleNode, setPeopleNode] = useState<OrgChartNode | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [people, setPeople] = useState<Employee[]>([]);
  const [peopleTotal, setPeopleTotal] = useState(0);

  const companyId = localStorage.getItem('companyId') || '';

  const flattenedDepartments = useMemo(() => flattenDepartments(hierarchy), [hierarchy]);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      setDivisions([]);
      setHierarchy([]);
      setPositions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [companyData, divisionData, hierarchyData, positionData] = await Promise.all([
        organizationService.getCompany(companyId),
        organizationService.getDivisions(companyId),
        organizationService.getDepartmentHierarchy(companyId),
        organizationService.getPositions(companyId),
      ]);

      setCompany(companyData);
      setDivisions(divisionData);
      setHierarchy(hierarchyData);
      setPositions(positionData);
    } catch (error) {
      console.error('Failed to load organization chart:', error);
      toast.error('Gagal memuat struktur organisasi');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tree = useMemo(() => {
    if (!company) return null;
    return buildOrgChartTree(company, divisions, hierarchy, positions);
  }, [company, divisions, hierarchy, positions]);

  const filteredTree = useMemo(() => {
    if (!tree) return null;
    return filterTree(tree, search);
  }, [tree, search]);

  useEffect(() => {
    if (!filteredTree) {
      setSelectedNode(null);
      return;
    }

    setSelectedNode((current) => {
      if (!current) return filteredTree;
      return findNodeById(filteredTree, current.id) || filteredTree;
    });
  }, [filteredTree]);

  const handleToggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const handleCollapseAll = () => {
    if (!tree) return;
    const ids = new Set<string>();
    collectExpandableIds(tree, ids);
    ids.delete(tree.id);
    setCollapsedIds(ids);
  };

  const handleSelectNode = useCallback(async (node: OrgChartNode) => {
    setSelectedNode(node);
    setPeopleNode(node);
    setPeopleDialogOpen(true);
    setPeopleLoading(true);
    setPeople([]);
    setPeopleTotal(0);

    if (!companyId) {
      setPeopleLoading(false);
      return;
    }

    try {
      if (node.type === 'department') {
        const result = await employeeService.getEmployees({
          companyId,
          departmentId: node.id,
          page: 1,
          limit: 100,
        });
        setPeople(result.data);
        setPeopleTotal(result.total || result.data.length);
        return;
      }

      if (node.type === 'position') {
        const result = await employeeService.getEmployees({
          companyId,
          positionId: node.id,
          page: 1,
          limit: 100,
        });
        setPeople(result.data);
        setPeopleTotal(result.total || result.data.length);
        return;
      }

      if (node.type === 'division') {
        const departmentIds = new Set(
          flattenedDepartments
            .filter((department) => department.divisionId === node.id)
            .map((department) => department.id)
        );

        const result = await employeeService.getEmployees({
          companyId,
          page: 1,
          limit: 300,
        });
        const filteredEmployees = result.data.filter((employee) => employee.departmentId && departmentIds.has(employee.departmentId));
        setPeople(filteredEmployees);
        setPeopleTotal(filteredEmployees.length);
        return;
      }

      const result = await employeeService.getEmployees({
        companyId,
        page: 1,
        limit: 300,
      });
      setPeople(result.data);
      setPeopleTotal(result.total || result.data.length);
    } catch (error) {
      console.error('Failed to load people for node:', error);
      toast.error('Gagal memuat daftar orang');
    } finally {
      setPeopleLoading(false);
    }
  }, [companyId, flattenedDepartments]);

  const stats = useMemo(() => ({
    divisions: divisions.length,
    departments: hierarchy.length,
    topDepartments: hierarchy.length,
    positions: positions.length,
  }), [divisions.length, hierarchy.length, positions.length]);

  return (
    <div>
      <PageHeader
        title="Organization Chart"
        description="Visualisasi struktur organisasi yang interaktif per company aktif."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExpandAll} disabled={!tree}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={handleCollapseAll} disabled={!tree}>
              Collapse All
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Divisions</p>
          <p className="mt-2 text-2xl font-semibold">{stats.divisions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Departments</p>
          <p className="mt-2 text-2xl font-semibold">{stats.topDepartments}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Positions</p>
          <p className="mt-2 text-2xl font-semibold">{stats.positions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
          <p className="mt-2 truncate text-sm font-semibold">{company?.name || '-'}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <div className="relative w-full lg:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Cari division, department, position, atau lead"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-3 py-2">Klik node untuk detail + daftar orang</span>
          <span className="rounded-full border border-border px-3 py-2">Expand/collapse per node</span>
          <span className="rounded-full border border-border px-3 py-2">Struktur mengikuti company aktif</span>
        </div>
      </div>

      {!companyId ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Company aktif belum tersedia. Pilih company dulu untuk melihat struktur organisasi.
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Memuat organization chart...
        </div>
      ) : !filteredTree ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Network size={36} className="mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? 'Tidak ada node yang cocok dengan pencarian.' : 'Belum ada struktur organisasi untuk company ini.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-6">
            <div className="min-w-max pb-4">
              <TreeNode
                node={filteredTree}
                selectedNodeId={selectedNode?.id || null}
                collapsedIds={collapsedIds}
                onToggle={handleToggle}
                onSelect={handleSelectNode}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            {selectedNode ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {selectedNode.type === 'company' ? <Building2 size={18} /> :
                     selectedNode.type === 'division' ? <GitBranch size={18} /> :
                     selectedNode.type === 'department' ? <Network size={18} /> :
                     <Briefcase size={18} />}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {DETAIL_LABELS[selectedNode.type]}
                    </p>
                    <h3 className="text-base font-semibold">{selectedNode.label}</h3>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Identifier</p>
                    <p className="mt-1 text-sm font-medium">{selectedNode.subtitle || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm font-medium">{selectedNode.status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lead / Head</p>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <UserRound size={14} className="text-muted-foreground" />
                      <span>{selectedNode.headName || '-'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Direct Children</p>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Users size={14} className="text-muted-foreground" />
                      <span>{selectedNode.children.length}</span>
                    </div>
                  </div>
                  {typeof selectedNode.employeeCount === 'number' && (
                    <div>
                      <p className="text-xs text-muted-foreground">People / Assigned</p>
                      <p className="mt-1 text-sm font-medium">{selectedNode.employeeCount}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
                Klik node mana pun di chart untuk melihat detailnya.
              </div>
            )}
          </div>
        </div>
      )}

      <PeopleDialog
        open={peopleDialogOpen}
        node={peopleNode}
        loading={peopleLoading}
        employees={people}
        total={peopleTotal}
        onClose={() => setPeopleDialogOpen(false)}
      />
    </div>
  );
}
