import { useEffect, useState } from "react";
import { api } from "@/api";
import { Plus, Award, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Certificates() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    student_id: "",
    course_id: "",
    registration_number: "",
    blank_series: "",
    blank_number: "",
    issue_date: "",
    status: "draft",
  });

  const load = async () => {
    const [certs, sts, crs] = await Promise.all([
      api.certificates.list(),
      api.students.list(),
      api.courses.list(),
    ]);
    setRows(certs);
    setStudents(sts);
    setCourses(crs);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    await api.certificates.create(form);
    setForm({ student_id: "", course_id: "", registration_number: "", blank_series: "", blank_number: "", issue_date: "", status: "draft" });
    load();
    toast({ title: "Сертификат создан" });
  };

  const handleIssue = async (cert) => {
    await api.certificates.update(cert.id, {
      status: "issued",
      issue_date: new Date().toISOString().split("T")[0],
    });
    load();
    toast({ title: "Сертификат выдан" });
  };

  const studentName = (id) => students.find((s) => s.id === id)?.name || id;
  const courseName = (id) => courses.find((c) => c.id === id)?.name || id;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Сертификаты</h2>
        <p className="text-sm text-muted-foreground">Черновики и выдача сертификатов</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3 p-4 border rounded-xl bg-card">
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
          <option value="">Ученик</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
          <option value="">Курс</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Рег. номер" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Серия бланка" value={form.blank_series} onChange={(e) => setForm({ ...form, blank_series: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Номер бланка" value={form.blank_number} onChange={(e) => setForm({ ...form, blank_number: e.target.value })} />
        <button onClick={handleCreate} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> Создать черновик
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((cert) => (
          <div key={cert.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold flex items-center gap-2"><Award className="w-4 h-4" /> {cert.registration_number}</p>
              <p className="text-xs text-muted-foreground">{studentName(cert.student_id)} · {courseName(cert.course_id)} · {cert.status}</p>
            </div>
            {cert.status === "draft" && (
              <button onClick={() => handleIssue(cert)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Выдать
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
