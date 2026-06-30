import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Video, Link, File, Loader2, BookOpen, ExternalLink, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { getMaterialUrl } from "@/lib/materialUrl";

const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50", label: "PDF" },
  pptx: { icon: FileText, color: "text-orange-500", bg: "bg-orange-50", label: "PPTX" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50", label: "Видео" },
  link: { icon: Link, color: "text-indigo-500", bg: "bg-indigo-50", label: "Ссылка" },
  other: { icon: File, color: "text-slate-500", bg: "bg-slate-50", label: "Файл" },
};

export default function StudentLessonMaterials() {
   const { user, isLoadingAuth } = useAuth();
   const [lessons, setLessons] = useState([]);
   const [materials, setMaterials] = useState([]);
   const [loading, setLoading] = useState(true);
   const [student, setStudent] = useState(null);
   const [viewMode, setViewMode] = useState("grouped"); // grouped | flat

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.id, isLoadingAuth]);

  const loadData = async () => {
    if (!user) return;
    const myStudents = user.student_profile_id
      ? await api.entities.Student.filter({ id: user.student_profile_id })
      : await api.entities.Student.filter({ user_id: user.id });
    const s = myStudents[0];
    if (!s) { setLoading(false); return; }
    setStudent(s);

    // Материалы из завершённых уроков
    const allLessons = await api.entities.Lesson.list("-date", 200);
    const myCompleted = allLessons.filter(l =>
      (l.student_id === s.id || (l.student_ids || []).includes(s.id)) &&
      l.status === "completed" &&
      l.material_ids && l.material_ids.length > 0
    );
    setLessons(myCompleted);

    // Получаем все материалы и фильтруем по доступу
    const allMaterialIds = myCompleted.flatMap(l => l.material_ids || []);
    
    if (allMaterialIds.length > 0) {
      const allMats = await api.entities.LessonMaterial.list("-created_date", 500);
      const lessonMaterialIds = new Set(allMaterialIds);
      setMaterials(allMats.filter(m => lessonMaterialIds.has(m.id)));
    }
    setLoading(false);
  };

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-slate-500">Профиль ученика не найден.</p>
      </div>
    );
  }

  const getMaterial = (id) => materials.find(m => m.id === id);

  const allMaterials = lessons.flatMap(l => 
    (l.material_ids || []).map(id => ({ material: getMaterial(id), lesson: l }))
  ).filter(x => x.material);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Мои материалы</h1>
          <p className="text-sm text-slate-500 mt-2">Материалы из завершённых уроков</p>
        </div>
        {lessons.length > 0 && (
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-2 text-sm font-medium rounded transition-colors ${viewMode === "grouped" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              По урокам
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`px-3 py-2 text-sm font-medium rounded transition-colors ${viewMode === "flat" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Все материалы
            </button>
          </div>
        )}
      </div>

      {lessons.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Материалы появятся после завершённых уроков</p>
          <p className="text-sm text-slate-400 mt-2">Преподаватель прикрепляет материалы при отметке урока как завершённого</p>
        </Card>
      ) : viewMode === "grouped" ? (
        <div className="space-y-8">
          {lessons.map(lesson => {
            const lessonMats = (lesson.material_ids || []).map(id => getMaterial(id)).filter(Boolean);
            if (lessonMats.length === 0) return null;
            return (
              <div key={lesson.id}>
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-200">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                    {format(new Date(lesson.date), "d")}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">
                      {format(new Date(lesson.date), "d MMMM yyyy", { locale: ru })} · {lesson.start_time}
                    </p>
                    <p className="text-sm text-slate-500">{lesson.teacher_name}</p>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
                    {lessonMats.length} материал{lessonMats.length % 10 === 1 ? "" : "ов"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-0">
                  {lessonMats.map(mat => {
                    const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
                    const IconComp = typeInfo.icon;
                    return (
                      <a key={mat.id} href={getMaterialUrl(mat)} target="_blank" rel="noopener noreferrer">
                        <Card className="p-4 hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300 h-full flex flex-col">
                          <div className="flex items-start justify-between mb-3">
                            <div className={`h-10 w-10 rounded-lg ${typeInfo.bg} flex items-center justify-center`}>
                              <IconComp className={`h-5 w-5 ${typeInfo.color}`} />
                            </div>
                            <ExternalLink className="h-4 w-4 text-slate-300" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2 mb-1">{mat.title}</p>
                          {mat.block_name && <p className="text-xs text-slate-400">{mat.block_name}</p>}
                        </Card>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allMaterials.map(({ material: mat, lesson }) => {
            const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
            const IconComp = typeInfo.icon;
            return (
              <a key={`${lesson.id}-${mat.id}`} href={getMaterialUrl(mat)} target="_blank" rel="noopener noreferrer">
                <Card className="p-4 hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-lg ${typeInfo.bg} flex items-center justify-center`}>
                      <IconComp className={`h-5 w-5 ${typeInfo.color}`} />
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">{mat.title}</p>
                  <p className="text-xs text-slate-500 mb-2">{format(new Date(lesson.date), "d MMM", { locale: ru })}</p>
                  {mat.block_name && <p className="text-xs text-slate-400">{mat.block_name}</p>}
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}