import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api";
import { Plus, Users, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { resolveAssignedTeacherLabel } from "@/lib/teacherLabels";

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

  useEffect(() => { load(); }, []);

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
      console.error("Failed to create group:", err);
      toast({
        title: "Не удалось создать группу",
        description: err.message || "Проверьте данные и попробуйте снова",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить группу?")) return;
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 w-full min-w-0">
      <div>
        <h2 className="text-xl font-bold">Группы</h2>
        <p className="text-sm text-muted-foreground">
          Создайте группу, затем в карточке настройте учеников, курс и расписание
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-xl bg-card">
        <input
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Название группы"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={form.teacher_id}
          onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
        >
          <option value="">Преподаватель *</option>
          {teachers.filter((t) => t.status !== "inactive").map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="md:col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? "Создание…" : "Создать группу"}
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : (
        <div className="space-y-3">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">Групп пока нет — создайте первую выше.</p>
          )}
          {groups.map((group) => (
            <div key={group.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
              <Link to={`/Groups/${group.id}`} className="flex-1 min-w-0 group">
                <p className="font-semibold group-hover:text-indigo-700 transition-colors">{group.name}</p>
                <p className="text-xs text-muted-foreground">{teacherName(group.teacher_id)} · {group.status}</p>
              </Link>
              <div className="flex gap-2 items-center">
                <Link
                  to={`/Groups/${group.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-50"
                >
                  <Users className="w-3.5 h-3.5" /> Открыть <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <button type="button" className="p-2 text-red-600" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
