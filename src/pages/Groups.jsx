import { useEffect, useState } from "react";
import { api, apiFetch } from "@/api";
import { Plus, Users, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { resolveAssignedTeacherLabel } from "@/lib/teacherLabels";

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", teacher_id: "", status: "active" });
  const [memberForm, setMemberForm] = useState({ groupId: "", student_id: "" });
  const [members, setMembers] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [g, t, s] = await Promise.all([
        api.groups.list(),
        api.teachers.list(),
        api.students.list(),
      ]);
      setGroups(g);
      setTeachers(t);
      setStudents(s);
    } catch (err) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadMembers = async (groupId) => {
    if (!groupId) return;
    const rows = await apiFetch(`/groups/${groupId}/members`);
    setMembers(Array.isArray(rows) ? rows : []);
  };

  const handleCreate = async () => {
    await api.groups.create(form);
    setForm({ name: "", teacher_id: "", status: "active" });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить группу?")) return;
    await api.groups.delete(id);
    load();
  };

  const handleAddMember = async () => {
    await apiFetch(`/groups/${memberForm.groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ studentId: memberForm.student_id }),
    });
    loadMembers(memberForm.groupId);
    toast({ title: "Участник добавлен" });
  };

  const teacherName = (id) => resolveAssignedTeacherLabel(id, teachers);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Группы</h2>
        <p className="text-sm text-muted-foreground">Управление группами и участниками</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-xl bg-card">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Название группы" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
          <option value="">Преподаватель</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={handleCreate} className="md:col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> Создать группу
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{group.name}</p>
                <p className="text-xs text-muted-foreground">{teacherName(group.teacher_id)} · {group.status}</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs border rounded-lg" onClick={() => { setMemberForm({ groupId: group.id, student_id: "" }); loadMembers(group.id); }}>Участники</button>
                <button className="p-2 text-red-600" onClick={() => handleDelete(group.id)}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {memberForm.groupId && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Участники группы</h3>
          <div className="flex gap-2">
            <select className="border rounded-lg px-3 py-2 text-sm flex-1" value={memberForm.student_id} onChange={(e) => setMemberForm({ ...memberForm, student_id: e.target.value })}>
              <option value="">Ученик</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={handleAddMember} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-1"><UserPlus className="w-4 h-4" /> Добавить</button>
          </div>
          <ul className="text-sm space-y-1">
            {members.map((m) => (
              <li key={m.id}>{students.find((s) => s.id === m.student_id)?.name || m.student_id}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
