import React, { useMemo, useState } from 'react';
import { api } from '@/api';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

function FolderNode({
  folder,
  folders,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
  canManage,
  depth = 0,
}) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const children = folders.filter((f) => (f.parent_id || f.parent_folder_id) === folder.id);
  const selected = selectedFolderId === folder.id;

  const createChild = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.materials.folders.create({
        course_id: folder.course_id,
        parent_folder_id: folder.id,
        name: name.trim(),
        sort_order: children.length,
      });
      setName('');
      setAdding(false);
      await onRefresh();
    } catch (err) {
      alert(err.message || 'Не удалось создать папку');
    } finally {
      setBusy(false);
    }
  };

  const deleteFolder = async () => {
    if (!confirm(`Удалить папку «${folder.name}»?`)) return;
    setBusy(true);
    try {
      await api.materials.folders.delete(folder.id);
      await onRefresh();
    } catch (err) {
      alert(err.message || 'Не удалось удалить папку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${
          selected ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200' : 'hover:bg-muted/70 text-foreground'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <button
          type="button"
          className="p-0.5 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {children.length > 0 ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="inline-block w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="flex flex-1 items-center gap-2 min-w-0 text-left"
          onClick={() => onSelectFolder({ courseId: folder.course_id, folderId: folder.id })}
        >
          <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {canManage && (
          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title="Подпапка"
              className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded"
              onClick={() => setAdding(true)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Удалить папку"
              disabled={busy}
              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded disabled:opacity-50"
              onClick={deleteFolder}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {adding && (
        <div className="ml-6 mt-1 mb-2 flex gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название"
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
          />
          <button
            type="button"
            disabled={busy}
            onClick={createChild}
            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
          >
            OK
          </button>
          <button type="button" onClick={() => setAdding(false)} className="px-2 py-1 text-xs border rounded">
            ✕
          </button>
        </div>
      )}

      {expanded &&
        children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onRefresh={onRefresh}
            canManage={canManage}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export default function FolderTree({
  courses,
  folders,
  materials,
  selectedCourseId,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
  canManage = false,
}) {
  const [expandedCourses, setExpandedCourses] = useState(() => new Set(courses.map((c) => c.id)));
  const [addingFolderFor, setAddingFolderFor] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);

  const countByCourse = useMemo(() => {
    const map = {};
    for (const m of materials) {
      const id = m.course_id || 'none';
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [materials]);

  const toggleCourse = (courseId) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const createRootFolder = async (courseId) => {
    if (!folderName.trim()) return;
    setBusy(true);
    try {
      await api.materials.folders.create({
        course_id: courseId,
        name: folderName.trim(),
        sort_order: folders.filter((f) => f.course_id === courseId && !(f.parent_id || f.parent_folder_id)).length,
      });
      setFolderName('');
      setAddingFolderFor(null);
      await onRefresh();
    } catch (err) {
      alert(err.message || 'Не удалось создать папку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="w-full lg:w-72 shrink-0 border border-border rounded-xl bg-card overflow-hidden flex flex-col max-h-[70vh]">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Курсы</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          type="button"
          onClick={() => onSelectFolder({ courseId: null, folderId: null })}
          className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left ${
            !selectedCourseId && !selectedFolderId
              ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50'
              : 'hover:bg-muted/70'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Все материалы
        </button>

        {courses.map((course) => {
          const courseFolders = folders.filter((f) => f.course_id === course.id);
          const roots = courseFolders.filter((f) => !(f.parent_id || f.parent_folder_id));
          const expanded = expandedCourses.has(course.id);
          const courseSelected = selectedCourseId === course.id && !selectedFolderId;

          return (
            <div key={course.id}>
              <div
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
                  courseSelected ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50' : 'hover:bg-muted/70'
                }`}
              >
                <button type="button" className="p-0.5" onClick={() => toggleCourse(course.id)}>
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 min-w-0 text-left"
                  onClick={() => onSelectFolder({ courseId: course.id, folderId: null })}
                >
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium">{course.course_name || course.course_type}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{countByCourse[course.id] || 0}</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    title="Новая папка"
                    className="p-1 opacity-0 group-hover:opacity-100 text-indigo-600 hover:bg-indigo-50 rounded"
                    onClick={() => {
                      setExpandedCourses((prev) => new Set(prev).add(course.id));
                      setAddingFolderFor(course.id);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {addingFolderFor === course.id && (
                <div className="ml-6 mt-1 mb-2 flex gap-1">
                  <input
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Папка"
                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => createRootFolder(course.id)}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                  >
                    OK
                  </button>
                </div>
              )}

              {expanded &&
                roots.map((folder) => (
                  <FolderNode
                    key={folder.id}
                    folder={folder}
                    folders={courseFolders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={onSelectFolder}
                    onRefresh={onRefresh}
                    canManage={canManage}
                    depth={1}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
