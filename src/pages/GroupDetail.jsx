import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ExternalLink,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/api';
import { toast } from '@/components/ui/use-toast';
import { resolveAssignedTeacherLabel } from '@/lib/teacherLabels';
import { resolveStudentLabel } from '@/lib/studentLabels';
import { formatTime } from '@/lib/time-slots';
import { formatDate } from '@/lib/formatters';
import { localizeLessonStatus } from '@/lib/locale-by';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageLoading,
} from '@/design-system';
import LessonAttendancePanel from '@/components/groups/LessonAttendancePanel';
import { splitGroupLessons } from '@/lib/groupLessons';

const TABS = [
  { id: 'students', label: 'Ученики' },
  { id: 'schedule', label: 'Расписание' },
];

const fieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('students');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [memberStudentId, setMemberStudentId] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', teacher_id: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedLessonId, setExpandedLessonId] = useState(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [ws, t, s] = await Promise.all([
        api.groups.workspace(groupId),
        api.teachers.list(),
        api.students.list(),
      ]);
      setWorkspace(ws);
      setTeachers(Array.isArray(t) ? t : []);
      setStudents(Array.isArray(s) ? s : []);
      const g = ws?.group;
      if (g) {
        setEditForm({
          name: g.name || '',
          teacher_id: g.teacher_id ?? g.teacherId ?? '',
        });
      }
    } catch (err) {
      toast({
        title: 'Не удалось загрузить группу',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const group = workspace?.group;
  const members = workspace?.members ?? [];
  const lessons = useMemo(() => {
    const rows = workspace?.lessons ?? [];
    // Defensive: only this group's lessons (workspace already filters by groupId).
    return rows.filter(
      (lesson) => (lesson.group_id ?? lesson.groupId) === groupId,
    );
  }, [workspace?.lessons, groupId]);

  const { upcoming, history } = useMemo(() => splitGroupLessons(lessons), [lessons]);

  const memberStudentIds = useMemo(
    () => new Set(members.map((m) => m.student_id ?? m.studentId).filter(Boolean)),
    [members],
  );

  const availableStudents = useMemo(
    () => students.filter((s) => s.status !== 'inactive' && !memberStudentIds.has(s.id)),
    [students, memberStudentIds],
  );

  const handleSaveEdit = async () => {
    if (!isAdmin || !groupId) return;
    const name = editForm.name.trim();
    if (!name) {
      toast({ title: 'Укажите название группы', variant: 'destructive' });
      return;
    }
    if (!editForm.teacher_id) {
      toast({ title: 'Выберите преподавателя', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      await api.groups.update(groupId, {
        name,
        teacher_id: editForm.teacher_id,
      });
      setEditing(false);
      await load();
      toast({ title: 'Группа обновлена' });
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddMember = async () => {
    if (!isAdmin) return;
    if (!memberStudentId) {
      toast({ title: 'Выберите ученика', variant: 'destructive' });
      return;
    }
    try {
      await api.groups.addMember(groupId, memberStudentId);
      setMemberStudentId('');
      await load();
      toast({ title: 'Ученик добавлен в группу' });
    } catch (err) {
      toast({
        title: 'Не удалось добавить ученика',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!isAdmin) return;
    if (!window.confirm('Удалить ученика из группы? Сам ученик останется в системе.')) {
      return;
    }
    try {
      await api.groups.removeMember(groupId, memberId);
      await load();
      toast({ title: 'Ученик удалён из группы' });
    } catch (err) {
      toast({
        title: 'Не удалось удалить ученика',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <PageLoading label="Загрузка группы…" />;
  }

  if (!group) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-red-600">Группа не найдена</p>
        <Link to="/Groups" className="text-sm text-brand hover:underline">
          ← К списку групп
        </Link>
      </div>
    );
  }

  const teacherLabel = resolveAssignedTeacherLabel(
    group.teacher_id ?? group.teacherId,
    teachers,
  );
  const scheduleHref =
    user?.role === 'teacher'
      ? createPageUrl('TeacherSchedule')
      : createPageUrl('Schedule');

  const renderLessonRow = (lesson, { showAttendance = false } = {}) => {
    const teacherName = resolveAssignedTeacherLabel(
      lesson.teacher_id ?? lesson.teacherId,
      teachers,
    );
    const when = `${formatDate(lesson.date)} · ${formatTime(lesson.start_time ?? lesson.startTime) || '—'}`;
    const status = localizeLessonStatus(lesson.status);
    const expanded = expandedLessonId === lesson.id;

    return (
      <li
        key={lesson.id}
        className="rounded-xl border border-border overflow-hidden"
        data-testid="group-lesson-row"
      >
        <button
          type="button"
          className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
          onClick={() =>
            setExpandedLessonId(expanded ? null : showAttendance ? lesson.id : null)
          }
        >
          <p className="text-sm font-medium text-foreground">{when}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {teacherName} · Групповое занятие · {status}
          </p>
        </button>
        {showAttendance && expanded ? (
          <div className="px-3 py-3 border-t border-border bg-card">
            <LessonAttendancePanel
              lessonId={lesson.id}
              students={students}
              isGroupLesson
            />
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-6" data-testid="group-detail">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <button
            type="button"
            onClick={() => navigate('/Groups')}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> К списку групп
          </button>

          {editing && isAdmin ? (
            <div className="space-y-3 max-w-lg">
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Название группы"
                data-testid="group-edit-name"
              />
              <select
                className={fieldClass}
                value={editForm.teacher_id}
                onChange={(e) => setEditForm({ ...editForm, teacher_id: e.target.value })}
                data-testid="group-edit-teacher"
              >
                <option value="">Преподаватель</option>
                {teachers
                  .filter((t) => t.status !== 'inactive')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? 'Сохранение…' : 'Сохранить'}
                </Button>
                <Button
                  type="button"
                  intent="outline"
                  onClick={() => {
                    setEditing(false);
                    setEditForm({
                      name: group.name || '',
                      teacher_id: group.teacher_id ?? group.teacherId ?? '',
                    });
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold truncate" title={group.name}>
                {group.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Преподаватель: {teacherLabel}
              </p>
              <p className="text-sm text-muted-foreground">Ученики: {members.length}</p>
            </>
          )}
        </div>

        {isAdmin && !editing ? (
          <Button
            type="button"
            intent="outline"
            className="gap-2 shrink-0"
            onClick={() => setEditing(true)}
            data-testid="group-edit"
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            data-testid={`group-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'students' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Ученики группы
            </CardTitle>
            <span className="text-xs text-muted-foreground">{members.length} в составе</span>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className={`${fieldClass} flex-1`}
                  value={memberStudentId}
                  onChange={(e) => setMemberStudentId(e.target.value)}
                  data-testid="group-add-student"
                >
                  <option value="">Выберите ученика</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || 'Без имени'}
                      {s.email ? ` · ${s.email}` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!memberStudentId}
                  className="gap-1"
                >
                  <UserPlus className="h-4 w-4" /> Добавить ученика
                </Button>
              </div>
            ) : null}

            {members.length === 0 ? (
              <EmptyState
                title="В группе пока нет учеников"
                description={
                  isAdmin
                    ? 'Добавьте первого ученика выше.'
                    : 'Состав группы назначит администратор.'
                }
              />
            ) : (
              <ul className="space-y-2" data-testid="group-members-list">
                {members.map((member) => {
                  const studentId = member.student_id ?? member.studentId;
                  const student = students.find((s) => s.id === studentId);
                  return (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {student?.name || resolveStudentLabel(studentId, students)}
                        </p>
                        {student?.email ? (
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        ) : null}
                      </div>
                      {isAdmin ? (
                        <Button
                          type="button"
                          intent="ghost"
                          size="sm"
                          className="text-red-600 shrink-0"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4" data-testid="group-schedule-readonly">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Только просмотр занятий этой группы. Планирование — в общем разделе «Расписание».
            </p>
            <Button asChild intent="outline" size="sm" className="gap-1.5">
              <Link to={scheduleHref}>
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть в расписании
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarRange className="h-4 w-4" /> Предстоящие занятия
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  title="Нет предстоящих занятий"
                  description="Создайте групповое занятие в общем разделе «Расписание»."
                />
              ) : (
                <ul className="space-y-2" data-testid="group-upcoming-lessons">
                  {upcoming.map((lesson) => renderLessonRow(lesson))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">История занятий</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState
                  title="История пока пуста"
                  description="Прошедшие занятия этой группы появятся здесь."
                />
              ) : (
                <ul className="space-y-2" data-testid="group-history-lessons">
                  {history.map((lesson) =>
                    renderLessonRow(lesson, { showAttendance: true }),
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
