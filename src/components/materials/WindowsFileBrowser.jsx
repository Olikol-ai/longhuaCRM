import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Folder, FolderOpen, FileText, Video, Link2, File, Plus, Search,
  Pencil, Trash2, Loader2, LayoutGrid, List, ArrowLeft, Lock,
  GripVertical, Copy, Scissors, Clipboard, ChevronRight, Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MaterialFormDialog from "./MaterialFormDialog";
import CourseFormDialog from "./CourseFormDialog";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import AccessControlModal from "./AccessControlModal";

const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50" },
  pptx: { icon: FileText, color: "text-orange-500", bg: "bg-orange-50" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50" },
  link: { icon: Link2, color: "text-indigo-500", bg: "bg-indigo-50" },
  other: { icon: File, color: "text-slate-500", bg: "bg-slate-50" },
};

export default function WindowsFileBrowser() {
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editMaterial, setEditMaterial] = useState(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [accessMaterial, setAccessMaterial] = useState(null);

  // Clipboard for copy/cut
  const [clipboard, setClipboard] = useState(null); // { type: 'copy'|'cut', items: [...] }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [c, m] = await Promise.all([
      api.entities.Course.list("-created_date"),
      api.entities.LessonMaterial.list("-created_date"),
    ]);
    setCourses(c);
    setMaterials(m);
    setLoading(false);
  };

  const courseMaterials = selectedCourse
    ? materials.filter(m => m.course_id === selectedCourse.id)
    : [];

  const filtered = courseMaterials.filter(m =>
    (m.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.block_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const getMaterialCount = (courseId) => materials.filter(m => m.course_id === courseId).length;

  const handleDragEnd = async (result) => {
    const { source, destination, type, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Handle material reorder or move to different course
    if (type === "MATERIAL") {
      const sourceCourseId = source.droppableId;
      const destCourseId = destination.droppableId;
      const material = materials.find(m => m.id === draggableId);

      if (sourceCourseId !== destCourseId) {
        // Move to different course
        await api.entities.LessonMaterial.update(draggableId, { course_id: destCourseId });
      }
      // Note: Order preservation can be added with a 'sort_order' field if needed
      loadData();
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    if (deleteTarget.type === "material") {
      await api.entities.LessonMaterial.delete(deleteTarget.item.id);
    } else {
      const courseMats = materials.filter(m => m.course_id === deleteTarget.item.id);
      await Promise.all(courseMats.map(m => api.entities.LessonMaterial.delete(m.id)));
      await api.entities.Course.delete(deleteTarget.item.id);
      if (selectedCourse?.id === deleteTarget.item.id) setSelectedCourse(null);
    }
    setDeleteTarget(null);
    setDeleting(false);
    loadData();
  };

  const handleCopy = (items) => {
    setClipboard({ type: "copy", items });
  };

  const handleCut = (items) => {
    setClipboard({ type: "cut", items });
  };

  const handlePaste = async () => {
    if (!clipboard || !selectedCourse) return;
    
    for (const item of clipboard.items) {
      if (item.type === "material") {
        const material = materials.find(m => m.id === item.id);
        if (material) {
          if (clipboard.type === "cut") {
            await api.entities.LessonMaterial.update(item.id, { course_id: selectedCourse.id });
          } else {
            // Copy: create new material with same data
            const { id, created_date, updated_date, created_by, ...rest } = material;
            await api.entities.LessonMaterial.create({ ...rest, course_id: selectedCourse.id, title: `${material.title} (копия)` });
          }
        }
      }
    }
    
    if (clipboard.type === "cut") {
      setClipboard(null);
    }
    loadData();
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-slate-50">
        {/* Top toolbar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
            <button
              onClick={() => setSelectedCourse(null)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors ${!selectedCourse ? "text-indigo-600 font-semibold" : "text-slate-500"}`}
            >
              <Home className="h-3.5 w-3.5" />
              <span>Библиотека</span>
            </button>
            {selectedCourse && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {selectedCourse.course_name || selectedCourse.course_type}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedCourse && clipboard && (
              <Button
                size="sm"
                onClick={handlePaste}
                className="bg-green-600 hover:bg-green-700 h-8 text-xs gap-1.5"
              >
                <Clipboard className="h-3.5 w-3.5" /> Вставить ({clipboard.items.length})
              </Button>
            )}
            {selectedCourse ? (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs gap-1.5"
                onClick={() => { setEditMaterial(null); setShowMaterialForm(true); }}
              >
                <Plus className="h-3.5 w-3.5" /> Загрузить
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs gap-1.5"
                onClick={() => { setEditCourse(null); setShowCourseForm(true); }}
              >
                <Plus className="h-3.5 w-3.5" /> Курс
              </Button>
            )}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar — courses */}
          <Droppable droppableId="courses" type="COURSE" isDropDisabled>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0"
              >
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Курсы</p>
                </div>
                <div className="flex-1 overflow-y-auto py-1.5 space-y-0.5 px-1.5">
                  {loading ? (
                    <div className="flex justify-center pt-8">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    </div>
                  ) : courses.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center pt-6">Нет курсов</p>
                  ) : (
                    courses.map((course, idx) => {
                      const isActive = selectedCourse?.id === course.id;
                      const count = getMaterialCount(course.id);
                      return (
                        <Draggable key={course.id} draggableId={course.id} index={idx} isDragDisabled>
                          {(provided, snapshot) => (
                            <button
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              onClick={() => { setSelectedCourse(course); setSearch(""); }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all group ${
                                snapshot.isDragging ? "bg-indigo-100 shadow-lg" : isActive ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="flex items-center gap-2">
                                <GripVertical className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {isActive ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-400" />}
                              </div>
                              <span className="flex-1 text-xs font-medium truncate">{course.course_name || course.course_type}</span>
                              {count > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{count}</span>}
                              <div className="hidden group-hover:flex gap-1 ml-1">
                                <button onClick={(e) => { e.stopPropagation(); setEditCourse(course); setShowCourseForm(true); }} className="p-1 rounded hover:bg-white text-slate-400 hover:text-slate-600"><Pencil className="h-3 w-3" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "course", item: course }); }} className="p-1 rounded hover:bg-white text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </button>
                          )}
                        </Draggable>
                      );
                    })
                  )}
                </div>
                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={() => { setEditCourse(null); setShowCourseForm(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Новый курс
                  </button>
                </div>
              </div>
            )}
          </Droppable>

          {/* Right panel — contents */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!selectedCourse ? (
              /* Home view */
              <div className="flex-1 overflow-y-auto p-6">
                <h2 className="text-sm font-semibold text-slate-500 mb-4">{courses.length} курс{courses.length !== 1 ? "ов" : ""}</h2>
                {courses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center pt-24 gap-4">
                    <Folder className="h-20 w-20 text-amber-200" />
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">Нет курсов</p>
                      <p className="text-sm text-slate-400 mt-1">Создайте первый курс</p>
                    </div>
                  </div>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-3 md:grid-cols-5 gap-4" : "space-y-1"}>
                    {courses.map(course => (
                      <div
                        key={course.id}
                        onDoubleClick={() => { setSelectedCourse(course); setSearch(""); }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-100 group cursor-pointer transition-colors"
                      >
                        <Folder className="h-14 w-14 text-amber-400" />
                        <p className="text-xs text-slate-700 text-center font-medium line-clamp-2">{course.course_name || course.course_type}</p>
                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
                          <button onClick={(e) => { e.stopPropagation(); setEditCourse(course); setShowCourseForm(true); }} className="p-1 rounded bg-white shadow text-slate-400 hover:text-slate-600"><Pencil className="h-3 w-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "course", item: course }); }} className="p-1 rounded bg-white shadow text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Course contents with DnD */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Назад
                  </button>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Поиск..."
                      className="pl-8 h-7 text-xs"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => { setEditCourse(selectedCourse); setShowCourseForm(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteTarget({ type: "course", item: selectedCourse })} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <Droppable droppableId={selectedCourse.id} type="MATERIAL">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-5 transition-colors ${snapshot.isDraggingOver ? "bg-indigo-50" : ""}`}
                    >
                      {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center pt-20 gap-4">
                          <FileText className="h-16 w-16 text-slate-200" />
                          <div className="text-center">
                            <p className="font-semibold text-slate-600">Папка пуста</p>
                            <p className="text-sm text-slate-400">Перетащите файлы или загрузите новый</p>
                          </div>
                        </div>
                      ) : (
                        <div className={viewMode === "grid" ? "grid grid-cols-3 md:grid-cols-5 gap-4" : "space-y-1"}>
                          {filtered.map((mat, idx) => {
                            const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
                            const IconComp = typeInfo.icon;
                            return (
                              <Draggable key={mat.id} draggableId={mat.id} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all group cursor-move ${
                                      snapshot.isDragging ? "shadow-xl bg-white scale-105" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <div {...provided.dragHandleProps} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100">
                                      <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                    <a href={mat.file_url} target="_blank" rel="noopener noreferrer">
                                      <div className={`h-14 w-14 rounded-2xl ${typeInfo.bg} flex items-center justify-center`}>
                                        <IconComp className={`h-7 w-7 ${typeInfo.color}`} />
                                      </div>
                                    </a>
                                    <p className="text-xs text-slate-700 text-center font-medium line-clamp-2">{mat.title}</p>
                                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
                                      <button onClick={() => handleCopy([{ type: "material", id: mat.id }])} className="p-1 rounded bg-white shadow text-slate-400 hover:text-blue-600" title="Копировать"><Copy className="h-3 w-3" /></button>
                                      <button onClick={() => handleCut([{ type: "material", id: mat.id }])} className="p-1 rounded bg-white shadow text-slate-400 hover:text-orange-600" title="Вырезать"><Scissors className="h-3 w-3" /></button>
                                      <button onClick={() => setAccessMaterial(mat)} className="p-1 rounded bg-white shadow text-slate-400 hover:text-indigo-600" title="Доступ"><Lock className="h-3 w-3" /></button>
                                      <button onClick={() => { setEditMaterial(mat); setShowMaterialForm(true); }} className="p-1 rounded bg-white shadow text-slate-400 hover:text-slate-600"><Pencil className="h-3 w-3" /></button>
                                      <button onClick={() => setDeleteTarget({ type: "material", item: mat })} className="p-1 rounded bg-white shadow text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        {showMaterialForm && (
          <MaterialFormDialog
            material={editMaterial}
            courses={courses}
            defaultCourseId={selectedCourse?.id}
            onClose={() => setShowMaterialForm(false)}
            onSave={() => { setShowMaterialForm(false); loadData(); }}
          />
        )}
        {showCourseForm && (
          <CourseFormDialog
            course={editCourse}
            onClose={() => setShowCourseForm(false)}
            onSave={(saved) => { setShowCourseForm(false); loadData().then(() => { if (!editCourse) setSelectedCourse(saved); }); }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            title={deleteTarget.type === "course" ? "Удалить курс" : "Удалить материал"}
            description={deleteTarget.type === "course" ? `Удалить «${deleteTarget.item.course_name || deleteTarget.item.course_type}» и все материалы?` : `Удалить «${deleteTarget.item.title}»?`}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
        {accessMaterial && (
          <AccessControlModal
            material={accessMaterial}
            course={selectedCourse}
            onClose={() => setAccessMaterial(null)}
            onSave={() => { setAccessMaterial(null); loadData(); }}
          />
        )}
      </div>
    </DragDropContext>
  );
}