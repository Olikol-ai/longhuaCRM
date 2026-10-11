import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/api';
import { toast } from '@/components/ui/use-toast';
import { resolveAssignedTeacherLabel } from '@/lib/teacherLabels';
import { useAuth } from '@/lib/AuthContext';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  PageLoading,
} from '@/design-system';

const fieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function Groups() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', teacher_id: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([api.groups.list(), api.teachers.list()]);
      setGroups(Array.isArray(g) ? g : []);
      setTeachers(Array.isArray(t) ? t : []);
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!isAdmin) return;
    const name = form.name.trim();
    if (!name) {
      toast({ title: 'Укажите название группы', variant: 'destructive' });
      return;
    }
    if (!form.teacher_id) {
      toast({
        title: 'Выберите преподавателя',
        description: 'Преподаватель нужен для расписания и уроков группы',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const created = await api.groups.create({
        name,
        teacher_id: form.teacher_id,
      });
      const groupId = created?.id;
      toast({
        title: 'Группа создана',
        description: 'Добавьте учеников и расписание в карточке группы',
      });
      setForm({ name: '', teacher_id: '' });
      if (groupId) {
        navigate(`/Groups/${groupId}`);
        return;
      }
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось создать группу',
        description: err.message || 'Проверьте данные и попробуйте снова',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, groupName) => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `Удалить группу${groupName ? ` «${groupName}»` : ''}?\n\nУченики и история уроков не удаляются.`,
      )
    ) {
      return;
    }
    try {
      await api.groups.delete(id);
      await load();
      toast({ title: 'Группа удалена' });
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const teacherName = (id) => resolveAssignedTeacherLabel(id, teachers);
  const membersCount = (group) =>
    Number(group.members_count ?? group.membersCount ?? 0) || 0;

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="groups-page"
    >
      <PageHeader
        title="Группы"
        description="Название, преподаватель и ученики. Занятия — в разделе «Расписание»."
      />

      {isAdmin ? (
        <Card className="min-w-0 overflow-hidden shadow-sm" data-testid="group-create-card">
          <CardHeader className="space-y-1 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Создать группу</CardTitle>
            <CardDescription>
              Курс и расписание не нужны здесь. Занятия создаются в «Расписании».
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 min-w-0">
                <label htmlFor="group-name" className="text-sm font-medium">
                  Название группы *
                </label>
                <Input
                  id="group-name"
                  className="h-11 md:h-10"
                  placeholder="Например, HSK 3"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  data-testid="group-name"
                />
              </div>
              <div className="space-y-2 min-w-0">
                <label htmlFor="group-teacher" className="text-sm font-medium">
                  Преподаватель *
                </label>
                <select
                  id="group-teacher"
                  className={fieldClass}
                  value={form.teacher_id}
                  onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                  data-testid="group-teacher"
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers
                    .filter((t) => t.status !== 'inactive')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="gap-2 min-h-11 w-full sm:w-auto"
                data-testid="group-create"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {creating ? 'Создание…' : 'Создать группу'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <PageLoading label="Загрузка групп…" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Групп пока нет"
          description={
            isAdmin
              ? 'Создайте первую группу — затем добавьте учеников и расписание.'
              : 'Администратор ещё не назначил вам группы.'
          }
        />
      ) : (
        <div className="space-y-3" data-testid="groups-list">
          {groups.map((group) => {
            const teacher = teacherName(group.teacher_id ?? group.teacherId);
            const count = membersCount(group);
            return (
              <article
                key={group.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm min-w-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={`/Groups/${group.id}`}
                    className="min-w-0 flex-1 space-y-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <h2
                      className="text-base font-semibold text-foreground truncate"
                      title={group.name}
                    >
                      {group.name}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate" title={teacher}>
                      Преподаватель: {teacher}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ученики: {count}
                    </p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button asChild intent="outline" size="sm" className="gap-1.5 min-h-10">
                      <Link to={`/Groups/${group.id}`}>
                        Открыть
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {isAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        intent="danger"
                        className="gap-1.5 min-h-10"
                        onClick={() => handleDelete(group.id, group.name)}
                        aria-label={`Удалить группу ${group.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
