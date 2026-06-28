import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { hasAccessToMaterial } from "@/lib/materialAccess";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, FileText, Video, Link2, File, Loader2, BookOpen,
  Eye, Trash2, Lock, Upload, Plus, FolderPlus, Edit2, ChevronDown, ChevronRight
} from "lucide-react";
import GrantAccessModal from "@/components/materials/GrantAccessModal";
import AccessManageModal from "@/components/materials/AccessManageModal";
import MaterialFormDialog from "@/components/materials/MaterialFormDialog";

const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50", label: "PDF" },
  pptx: { icon: FileText, color: "text-orange-500", bg: "bg-orange-50", label: "PPTX" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50", label: "Видео" },
  link: { icon: Link2, color: "text-indigo-500", bg: "bg-indigo-50", label: "Ссылка" },
  other: { icon: File, color: "text-slate-500", bg: "bg-slate-50", label: "Файл" },
};

export default function MaterialsHub() {
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState(new Set());
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [adminTab, setAdminTab] = useState("courses"); // "courses" | "materials" | "access"
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [courseFormData, setCourseFormData] = useState({
    course_name: "",
    course_type: "basic_beginner",
    total_lessons: 35,
  });
  const [selectedMaterialForAccess, setSelectedMaterialForAccess] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const me = await api.auth.me();
    setUser(me);

    const [allMats, c] = await Promise.all([
      api.entities.LessonMaterial.list("-created_date"),
      api.entities.Course.list(),
    ]);

    // Если учитель - фильтруем по доступу
    let m = allMats;
    if (me.role === "teacher") {
      const accessibleMats = [];
      for (const mat of allMats) {
        const hasAccess = await hasAccessToMaterial(me.id, mat.id);
        if (hasAccess) {
          accessibleMats.push(mat);
        }
      }
      m = accessibleMats;
    }

    setMaterials(m);
    setCourses(c);
    setLoading(false);
  };

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const handleSaveCourse = async () => {
    if (!courseFormData.course_name) {
      alert("Введите название курса");
      return;
    }

    setLoading(true);
    try {
      if (editingCourse) {
        await api.entities.Course.update(editingCourse.id, courseFormData);
      } else {
        await api.entities.Course.create(courseFormData);
      }
      setShowCourseForm(false);
      setEditingCourse(null);
      setCourseFormData({ course_name: "", course_type: "basic_beginner", total_lessons: 35 });
      await loadData();
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setCourseFormData({
      course_name: course.course_name || "",
      course_type: course.course_type,
      total_lessons: course.total_lessons || 35,
    });
    setShowCourseForm(true);
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm("Удалить курс? Материалы в этом курсе также будут удалены.")) return;
    setDeleting(id);
    try {
      await api.entities.Course.delete(id);
      const matsToDelete = materials.filter(m => m.course_id === id);
      for (const mat of matsToDelete) {
        await api.entities.LessonMaterial.delete(mat.id);
      }
      await loadData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Ошибка при удалении");
    } finally {
      setDeleting(null);
    }
  };

  const handleCancelCourseForm = () => {
    setShowCourseForm(false);
    setEditingCourse(null);
    setCourseFormData({ course_name: "", course_type: "basic_beginner", total_lessons: 35 });
  };

  const toggleMaterial = (matId) => {
    const newSet = new Set(selectedMaterialIds);
    if (newSet.has(matId)) {
      newSet.delete(matId);
    } else {
      newSet.add(matId);
    }
    setSelectedMaterialIds(newSet);
  };

  const handleDeleteMaterial = async (matId) => {
    if (!confirm("Удалить материал?")) return;
    setDeleting(matId);
    try {
      await api.entities.LessonMaterial.delete(matId);
      await loadData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Ошибка при удалении");
    } finally {
      setDeleting(null);
    }
  };

  const groupedMaterials = materials.reduce((acc, mat) => {
    const courseId = mat.course_id || "uncategorized";
    if (!acc[courseId]) acc[courseId] = [];
    acc[courseId].push(mat);
    return acc;
  }, {});

  const filteredMaterials = materials.filter(m =>
    (m.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.block_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Материалы уроков</h1>
            <p className="text-sm text-slate-500 mt-2">Управление материалами и доступом</p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowMaterialForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <Plus className="h-4 w-4" />
              Добавить материал
            </Button>
          )}
        </div>
        
        {/* Admin tabs */}
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => { setAdminTab("courses"); setSelectedMaterialIds(new Set()); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                adminTab === "courses"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Курсы
            </button>
            <button
              onClick={() => { setAdminTab("materials"); setSelectedMaterialIds(new Set()); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                adminTab === "materials"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Материалы
            </button>
            <button
              onClick={() => setAdminTab("access")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                adminTab === "access"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Lock className="h-4 w-4" />
              Доступ
            </button>
          </div>
        )}
      </div>

      {/* Courses Management Tab */}
      {isAdmin && adminTab === "courses" && (
        <div className="space-y-6">
          {showCourseForm && (
            <Card className="p-6 bg-slate-50 border-2 border-indigo-200">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Название курса *
                  </label>
                  <Input
                    value={courseFormData.course_name}
                    onChange={e =>
                      setCourseFormData(prev => ({ ...prev, course_name: e.target.value }))
                    }
                    placeholder="Например: Базовый курс"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Тип курса
                    </label>
                    <select
                      value={courseFormData.course_type}
                      onChange={e =>
                        setCourseFormData(prev => ({ ...prev, course_type: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="basic_beginner">Базовый</option>
                      <option value="advanced_beginner">Продвинутый начинающий</option>
                      <option value="advanced">Продвинутый</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Количество уроков
                    </label>
                    <Input
                      type="number"
                      value={courseFormData.total_lessons}
                      onChange={e =>
                        setCourseFormData(prev => ({ ...prev, total_lessons: parseInt(e.target.value) || 35 }))
                      }
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleCancelCourseForm}>
                    Отмена
                  </Button>
                  <Button
                    onClick={handleSaveCourse}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {editingCourse ? "Сохранить" : "Создать"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Курсы</h2>
            {!showCourseForm && (
              <Button
                onClick={() => setShowCourseForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                Создать курс
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {courses.map(course => {
              const courseMaterials = materials.filter(m => m.course_id === course.id);
              const isExpanded = expandedCourse === course.id;
              return (
                <Card key={course.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                      className="flex-1 flex items-center gap-3 text-left hover:bg-slate-50 rounded px-2 py-1 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-amber-500">📁</span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{course.course_name || course.course_type}</p>
                        <p className="text-xs text-slate-500">{courseMaterials.length} материалов</p>
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditCourse(course)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Редактировать"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        disabled={deleting === course.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Удалить"
                      >
                        {deleting === course.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                      {courseMaterials.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">Материалов нет</p>
                      ) : (
                        courseMaterials.map(mat => {
                          const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
                          const IconComp = typeInfo.icon;
                          return (
                            <div key={mat.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                              <IconComp className={`h-4 w-4 ${typeInfo.color}`} />
                              <span className="text-sm text-slate-700 flex-1">{mat.title}</span>
                              <button
                                onClick={() => setSelectedMaterialForAccess(mat.id)}
                                className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors text-xs font-medium"
                                title="Предоставить доступ"
                              >
                                <Lock className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteMaterial(mat.id)}
                                disabled={deleting === mat.id}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                              >
                                {deleting === mat.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      {(!isAdmin || adminTab === "materials") && (
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск материалов..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Selection toolbar */}
      {selectedMaterialIds.size > 0 && adminTab === "materials" && (
        <div className="mb-6 flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200 flex-wrap gap-3">
          <span className="text-sm text-indigo-700 font-medium">
            Выбрано {selectedMaterialIds.size} материал{selectedMaterialIds.size % 10 === 1 ? "" : "ов"}
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowGrantAccess(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Предоставить доступ
            </Button>
            <Button
              onClick={() => setSelectedMaterialIds(new Set())}
              variant="outline"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* Admin Access Management Tab */}
      {isAdmin && adminTab === "access" ? (
        <AccessManageModal closeTab={() => setAdminTab("materials")} />
      ) : isAdmin && adminTab === "courses" ? null : (
        <>
      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {search ? "Материалы не найдены" : "Материалы еще не добавлены"}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMaterials).map(([courseId, courseMats]) => {
            const course = courses.find(c => c.id === courseId);
            const visibleMats = courseMats.filter(m =>
              (m.title || "").toLowerCase().includes(search.toLowerCase())
            );

            if (visibleMats.length === 0) return null;

            return (
              <div key={courseId}>
                {course && (
                  <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="text-amber-500">📁</span>
                    {course.course_name || course.course_type}
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleMats.map(mat => {
                    const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
                    const IconComp = typeInfo.icon;
                    const isSelected = selectedMaterialIds.has(mat.id);

                    return (
                      <div
                        key={mat.id}
                        className={`relative group p-4 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-300"
                            : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm"
                        }`}
                      >
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMaterial(mat.id)}
                            className="absolute top-3 left-3 w-4 h-4 rounded border-2 border-indigo-300 accent-indigo-600 cursor-pointer z-10"
                          />
                        )}

                        <div className="flex items-start gap-3 mb-3 pl-7">
                          <div className={`h-10 w-10 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                            <IconComp className={`h-5 w-5 ${typeInfo.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {mat.title}
                            </p>
                            {mat.block_name && (
                              <p className="text-xs text-slate-500 mt-0.5">{mat.block_name}</p>
                            )}
                          </div>
                        </div>

                        {mat.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-3 pl-7">
                            {mat.description}
                          </p>
                        )}

                        <div className="flex gap-2 pl-7">
                          <a
                            href={mat.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                          >
                            <Eye className="h-3 w-3" />
                            Открыть
                          </a>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteMaterial(mat.id)}
                              disabled={deleting === mat.id}
                              className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Удалить"
                            >
                              {deleting === mat.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showGrantAccess && selectedMaterialIds.size > 0 && (
        <GrantAccessModal
          user={user}
          materialIds={Array.from(selectedMaterialIds)}
          onClose={() => setShowGrantAccess(false)}
          onSuccess={() => {
            setShowGrantAccess(false);
            setSelectedMaterialIds(new Set());
            loadData();
          }}
        />
      )}

      {selectedMaterialForAccess && (
        <GrantAccessModal
          user={user}
          materialIds={[selectedMaterialForAccess]}
          onClose={() => setSelectedMaterialForAccess(null)}
          onSuccess={() => {
            setSelectedMaterialForAccess(null);
            loadData();
          }}
        />
      )}

      {showMaterialForm && (
        <MaterialFormDialog
          onClose={() => setShowMaterialForm(false)}
          onSave={() => {
            setShowMaterialForm(false);
            loadData();
          }}
        />
      )}
        </>
      )}
    </div>
  );
}