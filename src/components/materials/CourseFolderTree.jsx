import React, { useState } from "react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";

function FolderNode({
  folder,
  childFolders,
  materials,
  depth,
  onRefresh,
  onConfigureAccess,
  onDeleteMaterial,
  onAddMaterial,
  deleting,
  fileTypeIcons,
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [saving, setSaving] = useState(false);

  const folderMaterials = materials.filter((m) => m.folder_id === folder.id);
  const nestedFolders = childFolders.filter((f) => f.parent_folder_id === folder.id);

  const handleCreateChild = async () => {
    if (!childName.trim()) return;
    setSaving(true);
    try {
      await api.entities.CourseFolder.create({
        course_id: folder.course_id,
        parent_folder_id: folder.id,
        name: childName.trim(),
        sort_order: nestedFolders.length,
      });
      setChildName("");
      setAddingChild(false);
      await onRefresh();
    } catch (err) {
      console.error("Folder create error:", err);
      alert("Ошибка при создании папки");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!confirm(`Удалить папку «${folder.name}»? Материалы переместятся в корень курса.`)) return;
    setSaving(true);
    try {
      await api.entities.CourseFolder.delete(folder.id);
      await onRefresh();
    } catch (err) {
      console.error("Folder delete error:", err);
      alert("Ошибка при удалении папки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ml-3 border-l border-border pl-3">
      <div className="flex items-center gap-2 py-1 group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="text-amber-500">📁</span>
        <span className="text-sm font-medium text-foreground flex-1">{folder.name}</span>
        <button
          onClick={() => onAddMaterial?.(folder.id)}
          className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Добавить материал"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setAddingChild(true)}
          className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Создать подпапку"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDeleteFolder}
          disabled={saving}
          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          title="Удалить папку"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {addingChild && (
        <div className="flex gap-2 my-2 ml-6">
          <Input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Название подпапки"
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreateChild} disabled={saving || !childName.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Создать"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setAddingChild(false); setChildName(""); }}>
            Отмена
          </Button>
        </div>
      )}

      {expanded && (
        <>
          {nestedFolders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              childFolders={childFolders}
              materials={materials}
              depth={depth + 1}
              onRefresh={onRefresh}
              onConfigureAccess={onConfigureAccess}
              onDeleteMaterial={onDeleteMaterial}
              onAddMaterial={onAddMaterial}
              deleting={deleting}
              fileTypeIcons={fileTypeIcons}
            />
          ))}
          {folderMaterials.map((mat) => {
            const typeInfo = fileTypeIcons[mat.file_type] || fileTypeIcons.other;
            const IconComp = typeInfo.icon;
            return (
              <div key={mat.id} className="flex items-center gap-2 p-2 ml-6 bg-muted/40 rounded">
                <IconComp className={`h-4 w-4 ${typeInfo.color}`} />
                <span className="text-sm text-foreground flex-1">{mat.title}</span>
                <button
                  onClick={() => onConfigureAccess(mat.id)}
                  className="p-1 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded text-xs font-medium"
                  title="Настроить доступ"
                >
                  <Lock className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDeleteMaterial(mat.id)}
                  disabled={deleting === mat.id}
                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-950 rounded disabled:opacity-50"
                >
                  {deleting === mat.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function CourseFolderTree({
  course,
  folders,
  materials,
  onRefresh,
  onConfigureAccess,
  onDeleteMaterial,
  onAddMaterial,
  deleting,
  fileTypeIcons,
}) {
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootName, setRootName] = useState("");
  const [saving, setSaving] = useState(false);

  const courseFolders = folders.filter((f) => f.course_id === course.id);
  const rootFolders = courseFolders.filter((f) => !f.parent_folder_id);
  const rootMaterials = materials.filter(
    (m) => m.course_id === course.id && !m.folder_id,
  );

  const handleCreateRoot = async () => {
    if (!rootName.trim()) return;
    setSaving(true);
    try {
      await api.entities.CourseFolder.create({
        course_id: course.id,
        parent_folder_id: null,
        name: rootName.trim(),
        sort_order: rootFolders.length,
      });
      setRootName("");
      setAddingRoot(false);
      await onRefresh();
    } catch (err) {
      console.error("Folder create error:", err);
      alert("Ошибка при создании папки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Структура курса</p>
        {!addingRoot && (
          <div className="flex gap-2">
            {onAddMaterial && (
              <button
                onClick={() => onAddMaterial(null)}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Материал
              </button>
            )}
            <button
              onClick={() => setAddingRoot(true)}
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
            >
              <FolderPlus className="h-3 w-3" /> Папка
            </button>
          </div>
        )}
      </div>

      {addingRoot && (
        <div className="flex gap-2">
          <Input
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            placeholder="Название папки"
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreateRoot} disabled={saving || !rootName.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Создать"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setAddingRoot(false); setRootName(""); }}>
            Отмена
          </Button>
        </div>
      )}

      {rootFolders.length === 0 && rootMaterials.length === 0 && !addingRoot && (
        <p className="text-sm text-muted-foreground text-center py-4">Материалов и папок нет</p>
      )}

      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          childFolders={courseFolders}
          materials={materials.filter((m) => m.course_id === course.id)}
          depth={0}
          onRefresh={onRefresh}
          onConfigureAccess={onConfigureAccess}
          onDeleteMaterial={onDeleteMaterial}
          onAddMaterial={onAddMaterial}
          deleting={deleting}
          fileTypeIcons={fileTypeIcons}
        />
      ))}

      {rootMaterials.map((mat) => {
        const typeInfo = fileTypeIcons[mat.file_type] || fileTypeIcons.other;
        const IconComp = typeInfo.icon;
        return (
          <div key={mat.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded">
            <IconComp className={`h-4 w-4 ${typeInfo.color}`} />
            <span className="text-sm text-foreground flex-1">{mat.title}</span>
            <button
              onClick={() => onConfigureAccess(mat.id)}
              className="p-1 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded text-xs font-medium"
              title="Настроить доступ"
            >
              <Lock className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDeleteMaterial(mat.id)}
              disabled={deleting === mat.id}
              className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-950 rounded disabled:opacity-50"
            >
              {deleting === mat.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
