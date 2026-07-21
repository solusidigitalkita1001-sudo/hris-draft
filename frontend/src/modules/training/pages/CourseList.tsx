import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainingService, type TrainingCourse, type TrainingCategory } from '@/services/training.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompanyStore } from '@/stores/company.store';
import { Search, RefreshCw, Plus, GraduationCap, BookOpen, Users, Clock, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export function CourseList() {
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchData = useCallback(async () => {
    const companyId = activeCompany?.id || '';
    if (!companyId) {
      setCourses([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [courseData, catData] = await Promise.all([
        trainingService.getCourses(companyId, categoryFilter || undefined),
        trainingService.getCategories(companyId),
      ]);
      setCourses(courseData);
      setCategories(catData);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      toast.error('Gagal memuat data course');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.provider?.toLowerCase().includes(search.toLowerCase())
  );

  const totalEnrollments = courses.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0);
  const mandatoryCount = courses.filter((c) => c.isMandatory).length;

  return (
    <div>
      <PageHeader
        title="Learning Management"
        description="Manage training courses, sessions, and employee enrollments"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/lms/courses/new')}>
              <Plus size={16} className="mr-2" />
              New Course
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <BookOpen size={14} /> Total Courses
          </div>
          <p className="text-xl font-semibold">{courses.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users size={14} /> Total Enrollments
          </div>
          <p className="text-xl font-semibold">{totalEnrollments}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Award size={14} /> Mandatory
          </div>
          <p className="text-xl font-semibold">{mandatoryCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              !categoryFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <GraduationCap size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No courses found</p>
              <p className="text-xs text-muted-foreground">Create training courses to get started</p>
            </div>
          </div>
        ) : (
          filtered.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/lms/courses/${course.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <GraduationCap size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{course.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{course.code}</p>
                </div>
                {course.isMandatory && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                    Mandatory
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                {course.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                    {course.category.name}
                  </span>
                )}
                {course.duration && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                    <Clock size={12} />
                    {course.duration} {course.durationUnit || 'hrs'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {course.provider && <span>By {course.provider}</span>}
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {course._count?.enrollments || 0} enrolled
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {course._count?.sessions || 0} sessions
                </span>
              </div>

              {course.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{course.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
