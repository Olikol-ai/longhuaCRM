import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api";
import {
  Plus,
  Users,
  Trash2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { resolveAssignedTeacherLabel } from "@/lib/teacherLabels";
import { localizeEntityStatus } from "@/lib/locale-by";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageHeader from "@/components/responsive/PageHeader";
import { Badge } from "@/components/ui/badge";

const fieldClass =
  "h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", teacher_id: "", status: "active" });

  const load = async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([
        api.groups.list(),
        api.teachers.list(),
      ]);
      setGroups(g);
      setTeachers(t);
    } catch (err) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Укажите название группы", variant: "destructive" });
      return;
    }
    if (!form.teacher_id) {
      toast({
        title: "Выберите преподавателя",
        description: "Преподаватель нужен для расписания и уроков группы",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const created = await api.groups.create({
        name,
        teacher_id: form.teacher_id,
        status: form.status,
      });
      const groupId = created?.id;
      toast({
        title: "Группа создана",
        description: "Настройте учеников и расписание в карточке группы",
      });
      setForm({ name: "", teacher_id: "", status: "active" });
      if (groupId) {
        navigate(`/Groups/${groupId}`);
        return;
      }
      await load();
    } catch (err) {
      toast({
        title: "Не удалось создать группу",
        description: err.message || "Проверьте данные и попробуйте снова",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, groupName) => {
    if (
      !window.confirm(
        `Удалить группу${groupName ? ` «${groupName}»` : ""}?\n\nЭто действие нельзя отменить.`,
      )
    ) {
      return;
    }
    try {
      await api.groups.delete(id);
      await load();
      toast({ title: "Группа удалена" });
    } catch (err) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const teacherName = (id) => resolveAssignedTeacherLabel(id, teachers);

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="groups-page"
    >
      <PageHeader
        title="Группы"
        description="Создайте группу, затем в карточке настройте учеников, курс и расписание"
      />

      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Новая группа</CardTitle>
          <CardDescription>
            Название и преподаватель обязательны. Дальше — ученики и расписание.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="group-name">Название *</Label>
              <Input
                id="group-name"
                className="h-11 md:h-10"
                placeholder="Например, HSK 2 · вечер"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                data-testid="group-name"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="group-teacher">Преподаватель *</Label>
              <select
                id="group-teacher"
                className={fieldClass}
                value={form.teacher_id}
                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                data-testid="group-teacher"
              >
                <option value="">Выберите преподавателя</option>
                {teachers
                  .filter((t) => t.status !== "inactive")
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
              {creating ? "Создание…" : "Создать группу"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center space-y-3">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Групп пока нет</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Создайте первую группу выше — затем добавьте учеников и расписание.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="groups-list">
          {groups.map((group) => {
            const teacher = teacherName(group.teacher_id);
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
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <h2
                        className="text-base font-semibold text-foreground truncate"
                        title={group.name}
                      >
                        {group.name}
                      </h2>
                      <Badge variant="secondary" className="shrink-0">
                        {localizeEntityStatus(group.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate" title={teacher}>
                      {teacher}
                    </p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button asChild variant="outline" size="sm" className="gap-1.5 min-h-10">
                      <Link to={`/Groups/${group.id}`}>
                        <Users className="h-3.5 w-3.5" />
                        Открыть
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 min-h-10"
                      onClick={() => handleDelete(group.id, group.name)}
                      aria-label={`Удалить группу ${group.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </Button>
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
