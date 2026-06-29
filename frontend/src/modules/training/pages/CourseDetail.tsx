import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trainingService, type TrainingCourse } from '@/services/training.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import {
  ArrowLeft, BookOpen, Users, Clock, CalendarDays,
  UserRound, MapPin, FileText, CheckCircle2, AlertCircle,
  UserPlus, CheckSquare,
} from 'lucide-react';
import { formatDateTime } from '@/utils/format';

const SESSION_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const ENROLLMENT_STYLES: Record<string, string> = {
  ENROLLED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  DROPPED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

function Badge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await trainingService.getCourse(id);
      setCourse(data);
    } catch (error) {
      console.error('Failed to fetch course:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleEnroll = useCallback(async () => {
    if (!id) return;
    setEnrolling(true);
    try {
      await trainingService.enroll(id);
      toast.success('Successfully enrolled in course');
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  }, [id, fetchData]);

  const handleComplete = useCallback(async () => {
    if (!id) return;
    setCompleting(true);
    try {
      await trainingService.complete(id);
      toast.success('Course marked as completed');
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to complete course');
    } finally {
      setCompleting(false);
    }
  }, [id, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Course not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/lms')}>
          Back to Courses
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={course.title}
        description={`${course.code}${course.category ? ` · ${course.category.name}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleEnroll} disabled={enrolling}>
              <UserPlus size={16} className="mr-2" />
              {enrolling ? 'Enrolling...' : 'Enroll'}
            </Button>
            <Button size="sm" onClick={handleComplete} disabled={completing}>
              <CheckSquare size={16} className="mr-2" />
              {completing ? 'Completing...' : 'Complete'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/lms')}>
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Course Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock size={14} /> Duration
              </div>
              <p className="text-sm font-medium">
                {course.duration ? `${course.duration} ${course.durationUnit || 'hrs'}` : '-'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users size={14} /> Enrolled
              </div>
              <p className="text-sm font-medium">{course.enrollments?.length || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <BookOpen size={14} /> Sessions
              </div>
              <p className="text-sm font-medium">{course.sessions?.length || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                {course.isMandatory ? <CheckCircle2 size={14} className="text-amber-500" /> : <AlertCircle size={14} />}
                Type
              </div>
              <p className="text-sm font-medium">{course.isMandatory ? 'Mandatory' : 'Optional'}</p>
            </div>
          </div>

          {/* Description */}
          {course.description && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>
            </div>
          )}

          {/* Provider */}
          {course.provider && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-1">Provider</h3>
              <p className="text-sm text-muted-foreground">{course.provider}</p>
            </div>
          )}

          {/* Materials */}
          {course.materials && course.materials.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Materials</h3>
              <div className="space-y-2">
                {course.materials.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <FileText size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{m.title}</span>
                    <span className="text-xs text-muted-foreground">{m.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions */}
          {course.sessions && course.sessions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Sessions</h3>
              <div className="space-y-2">
                {course.sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                      <CalendarDays size={16} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {session.trainer && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <UserRound size={12} /> {session.trainer}
                          </span>
                        )}
                        <Badge status={session.status} styles={SESSION_STYLES} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateTime(session.startDate)}</span>
                        {session.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {session.location}
                          </span>
                        )}
                        {session.maxParticipants && (
                          <span className="flex items-center gap-1">
                            <Users size={12} /> Max {session.maxParticipants}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right - Enrollments */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Enrollments</h3>
              <span className="text-xs text-muted-foreground">
                {course.enrollments?.length || 0} enrolled
              </span>
            </div>

            {(!course.enrollments || course.enrollments.length === 0) ? (
              <div className="text-center py-8">
                <Users size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No enrollments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {course.enrollments.map((enr) => (
                  <div key={enr.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {enr.employee ? enr.employee.fullName.split(' ').map(n => n[0]).join('').substring(0, 2) : '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {enr.employee?.fullName || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge status={enr.status} styles={ENROLLMENT_STYLES} />
                        {enr.status !== 'CANCELLED' && enr.status !== 'DROPPED' && (
                          <span className="text-[10px] text-muted-foreground">{enr.progress}%</span>
                        )}
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    {enr.status !== 'CANCELLED' && enr.status !== 'DROPPED' && (
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${enr.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${enr.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
