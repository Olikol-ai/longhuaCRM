import { useState, useEffect } from "react";
import { api } from '@/api';
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { FileText, Video, Link, File, Loader2, BookOpen, ExternalLink } from "lucide-react";
import { getMaterialUrl } from "@/lib/materialUrl";
import AccessSourceBadges from "@/components/materials/AccessSourceBadges";

const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", label: "PDF" },
  pptx: { icon: FileText, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/40", label: "PPTX" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", label: "Видео" },
  link: { icon: Link, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/40", label: "Ссылка" },
  other: { icon: File, color: "text-slate-500", bg: "bg-muted", label: "Файл" },
};

export default function StudentLessonMaterials() {
  const { user, isLoadingAuth } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.id, isLoadingAuth]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [matsResult, coursesResult] = await Promise.allSettled([
        api.materials.list("-created_date", 500),
        api.courses.list(),
      ]);

      if (matsResult.status === "fulfilled") {
        setMaterials(Array.isArray(matsResult.value) ? matsResult.value : []);
      } else {
        console.error("Failed to load student materials:", matsResult.reason);
        setMaterials([]);
        setError(matsResult.reason?.message || "Не удалось загрузить материалы");
      }

      if (coursesResult.status === "fulfilled") {
        setCourses(Array.isArray(coursesResult.value) ? coursesResult.value : []);
      } else {
        console.error("Failed to load courses for student materials:", coursesResult.reason);
        setCourses([]);
      }
    } catch (err) {
      console.error("Failed to load student materials:", err);
      setMaterials([]);
      setCourses([]);
      setError(err.message || "Не удалось загрузить материалы");
    } finally {
      setLoading(false);
    }
  };

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const courseNameById = new Map(courses.map((c) => [c.id, c.course_name || c.course_type || "Курс"]));

  const filtered = materials.filter((m) => {
    if (m.status === "deleted") return false;
    const q = search.toLowerCase();
    return (
      (m.title || "").toLowerCase().includes(q) ||
      (m.block_name || "").toLowerCase().includes(q) ||
      (courseNameById.get(m.course_id) || "").toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, mat) => {
    const key = mat.course_id || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(mat);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto" data-testid="student-materials-page">
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Мои материалы</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Материалы, к которым вам предоставлен доступ. Рядом с каждым указан источник.
          </p>
        </div>
        {materials.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground w-full max-w-xs"
          />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed" data-testid="student-materials-empty">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">
            {search ? "Материалы не найдены" : "Пока нет доступных материалов"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {search
              ? "Попробуйте изменить поисковый запрос"
              : "Преподаватель или администратор выдаст доступ через раздел «Материалы»"}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([courseId, courseMats]) => (
            <div key={courseId}>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-amber-500">📁</span>
                {courseId === "other" ? "Без курса" : courseNameById.get(courseId) || "Курс"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {courseMats.map((mat) => {
                  const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
                  const IconComp = typeInfo.icon;
                  return (
                    <a
                      key={mat.id}
                      href={getMaterialUrl(mat)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`student-material-${mat.id}`}
                    >
                      <Card className="p-4 hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 h-full flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`h-10 w-10 rounded-lg ${typeInfo.bg} flex items-center justify-center`}>
                            <IconComp className={`h-5 w-5 ${typeInfo.color}`} />
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{mat.title}</p>
                        {mat.block_name && (
                          <p className="text-xs text-muted-foreground mb-2">{mat.block_name}</p>
                        )}
                        <AccessSourceBadges sources={mat.access_sources} className="mt-auto pt-2" />
                      </Card>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
