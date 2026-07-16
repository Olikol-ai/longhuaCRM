import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '@/api';
import { toast } from '@/components/ui/use-toast';
import { getCourseDisplayName } from '@/lib/courseLabels';
import { isMaterialDrag, readMaterialDragIds } from '@/lib/materialDrag';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

function parentKey(folder) {
  return folder.parent_id || folder.parent_folder_id || null;
}

function sortFolders(list) {
  return [...list].sort((a, b) => {
    const ao = Number(a.sort_order ?? a.sortOrder ?? 0);
    const bo = Number(b.sort_order ?? b.sortOrder ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
}

function useMaterialDropTarget({ enabled, onDropMaterials, target }) {
  const [over, setOver] = useState(false);

  if (!enabled) {
    return {
      isOver: false,
      dropProps: {},
    };
  }

  return {
    isOver: over,
    dropProps: {
      onDragEnter: (e) => {
        if (!isMaterialDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      },
      onDragOver: (e) => {
        if (!isMaterialDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      },
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const ids = readMaterialDragIds(e.dataTransfer);
        if (ids.length === 0) return;
        onDropMaterials?.(ids, target);
      },
    },
  };
}

function FolderRow({
  folder,
  childrenCount,
  selected,
  depth,
  expanded,
  canManage,
  busy,
  onToggleExpand,
  onSelect,
  onStartAdd,
  onDelete,
  dragHandleProps,
  dropProps,
  isDropOver,
}) {
  return (
    <div
      {...(dropProps || {})}
      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        isDropOver
          ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100'
          : selected
            ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
            : 'hover:bg-muted/70 text-foreground'
      }`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      title={dropProps ? 'Отпустите, чтобы переместить материал сюда' : undefined}
    >
      {canManage && (
        <span
          {...(dragHandleProps || {})}
          className="p-0.5 text-muted-foreground cursor-grab active:cursor-grabbing"
          title="Перетащить"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <button
        type="button"
        className="p-0.5 text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {childrenCount > 0 ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <span className="inline-block w-3.5" />
        )}
      </button>
      <button
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-left"
        onClick={onSelect}
      >
        <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="truncate">{folder.name}</span>
      </button>
      {canManage && (
        <div className="flex shrink-0">
          <button
            type="button"
            title="Подпапка"
            className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded"
            onClick={onStartAdd}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Удалить папку"
            disabled={busy}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded disabled:opacity-50"
            onClick={onDelete}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  folders,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
  canManage,
  enableDrag,
  canReceiveMaterials = false,
  onDropMaterials,
  depth = 0,
  index,
}) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { isOver, dropProps } = useMaterialDropTarget({
    enabled: canReceiveMaterials,
    onDropMaterials,
    target: { courseId: folder.course_id, folderId: folder.id },
  });

  const children = sortFolders(
    folders.filter((f) => parentKey(f) === folder.id),
  );
  const selected = selectedFolderId === folder.id;
  const droppableId = `folder-children:${folder.id}`;

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
      toast({
        title: 'Не удалось создать папку',
        description: err.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
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
      toast({ title: 'Папка удалена' });
    } catch (err) {
      toast({
        title: 'Не удалось удалить папку',
        description: err.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const passDrop = {
    canReceiveMaterials,
    onDropMaterials,
  };

  const childrenList = expanded && (
    enableDrag ? (
      <Droppable droppableId={droppableId} type={`FOLDER:${folder.id}`}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {children.map((child, childIndex) => (
              <FolderNode
                key={child.id}
                folder={child}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onRefresh={onRefresh}
                canManage={canManage}
                enableDrag={enableDrag}
                depth={depth + 1}
                index={childIndex}
                {...passDrop}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    ) : (
      <div>
        {children.map((child, childIndex) => (
          <FolderNode
            key={child.id}
            folder={child}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onRefresh={onRefresh}
            canManage={canManage}
            enableDrag={enableDrag}
            depth={depth + 1}
            index={childIndex}
            {...passDrop}
          />
        ))}
      </div>
    )
  );

  const addForm = adding && (
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
  );

  const row = (dragHandleProps) => (
    <>
      <FolderRow
        folder={folder}
        childrenCount={children.length}
        selected={selected}
        depth={depth}
        expanded={expanded}
        canManage={canManage}
        busy={busy}
        onToggleExpand={() => setExpanded((v) => !v)}
        onSelect={() => onSelectFolder({ courseId: folder.course_id, folderId: folder.id })}
        onStartAdd={() => setAdding(true)}
        onDelete={deleteFolder}
        dragHandleProps={dragHandleProps}
        dropProps={dropProps}
        isDropOver={isOver}
      />
      {addForm}
      {childrenList}
    </>
  );

  if (!enableDrag) {
    return <div>{row(null)}</div>;
  }

  return (
    <Draggable
      draggableId={`folder:${folder.id}`}
      index={index}
      isDragDisabled={!canManage}
    >
      {(dragProvided, snapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          className={snapshot.isDragging ? 'opacity-90' : undefined}
        >
          {row(dragProvided.dragHandleProps)}
        </div>
      )}
    </Draggable>
  );
}

function CourseBody({
  course,
  dragHandleProps,
  snapshotDragging,
  folders,
  countByCourse,
  selectedCourseId,
  selectedFolderId,
  expanded,
  isDeleting,
  addingFolderFor,
  folderName,
  setFolderName,
  busy,
  canManage,
  enableDrag,
  canReceiveMaterials,
  onDropMaterials,
  onSelectFolder,
  onRefresh,
  toggleCourse,
  setExpandedCourses,
  setAddingFolderFor,
  createRootFolder,
  deleteCourse,
}) {
  const courseFolders = folders.filter((f) => f.course_id === course.id);
  const roots = sortFolders(courseFolders.filter((f) => !parentKey(f)));
  const courseSelected = selectedCourseId === course.id && !selectedFolderId;
  const label = getCourseDisplayName(course);
  const { isOver, dropProps } = useMaterialDropTarget({
    enabled: canReceiveMaterials,
    onDropMaterials,
    target: { courseId: course.id, folderId: null },
  });

  const passDrop = {
    canReceiveMaterials,
    onDropMaterials,
  };

  return (
    <div
      className={`rounded-lg border border-transparent hover:border-border/60 ${
        snapshotDragging ? 'bg-card shadow-md border-border' : ''
      }`}
    >
      <div
        {...(dropProps || {})}
        className={`flex flex-col gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
          isOver
            ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100'
            : courseSelected
              ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50'
              : ''
        }`}
        title={canReceiveMaterials ? 'Отпустите, чтобы переместить материал в корень курса' : undefined}
      >
        <div className="flex items-center gap-1 min-w-0">
          {canManage && (
            <span
              {...(dragHandleProps || {})}
              className="p-0.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
              title="Перетащить курс"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          )}
          <button
            type="button"
            className="p-0.5 shrink-0"
            onClick={() => toggleCourse(course.id)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 min-w-0 text-left"
            onClick={() => onSelectFolder({ courseId: course.id, folderId: null })}
          >
            <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="truncate font-medium">{label}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {countByCourse[course.id] || 0}
            </span>
          </button>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-1 pl-6">
            <button
              type="button"
              title="Новая папка"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
              onClick={() => {
                setExpandedCourses((prev) => new Set(prev).add(course.id));
                setAddingFolderFor(course.id);
              }}
            >
              <Plus className="h-3 w-3" />
              Папка
            </button>
            <button
              type="button"
              title="Удалить курс"
              aria-label={`Удалить курс ${label}`}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
              disabled={busy}
              onClick={() => deleteCourse(course)}
              data-testid={`delete-course-${course.id}`}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Удалить
            </button>
          </div>
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
          <button
            type="button"
            onClick={() => setAddingFolderFor(null)}
            className="px-2 py-1 text-xs border rounded"
          >
            ✕
          </button>
        </div>
      )}

      {expanded && (
        enableDrag ? (
          <Droppable
            droppableId={`course-roots:${course.id}`}
            type={`FOLDER:root:${course.id}`}
          >
            {(folderProvided) => (
              <div
                ref={folderProvided.innerRef}
                {...folderProvided.droppableProps}
              >
                {roots.map((folder, folderIndex) => (
                  <FolderNode
                    key={folder.id}
                    folder={folder}
                    folders={courseFolders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={onSelectFolder}
                    onRefresh={onRefresh}
                    canManage={canManage}
                    enableDrag={enableDrag}
                    depth={1}
                    index={folderIndex}
                    {...passDrop}
                  />
                ))}
                {folderProvided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <div>
            {roots.map((folder, folderIndex) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                folders={courseFolders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onRefresh={onRefresh}
                canManage={canManage}
                enableDrag={enableDrag}
                depth={1}
                index={folderIndex}
                {...passDrop}
              />
            ))}
          </div>
        )
      )}
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
  canReceiveMaterials = false,
  onDropMaterials,
}) {
  // Teachers/students must not use DnD: missing drag handles crash @hello-pangea/dnd
  // ("Unable to find drag handle") when Draggable is enabled without a handle element.
  const enableDrag = Boolean(canManage);
  const [expandedCourses, setExpandedCourses] = useState(() => new Set(courses.map((c) => c.id)));
  const [addingFolderFor, setAddingFolderFor] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [reordering, setReordering] = useState(false);

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const ao = Number(a.sort_order ?? a.sortOrder ?? 0);
      const bo = Number(b.sort_order ?? b.sortOrder ?? 0);
      if (ao !== bo) return ao - bo;
      return getCourseDisplayName(a).localeCompare(getCourseDisplayName(b), 'ru');
    });
  }, [courses]);

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
      const rootCount = folders.filter(
        (f) => f.course_id === courseId && !parentKey(f),
      ).length;
      await api.materials.folders.create({
        course_id: courseId,
        name: folderName.trim(),
        sort_order: rootCount,
      });
      setFolderName('');
      setAddingFolderFor(null);
      await onRefresh();
    } catch (err) {
      toast({
        title: 'Не удалось создать папку',
        description: err.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const createCourse = async () => {
    const name = courseName.trim();
    if (!name) {
      toast({
        title: 'Введите название курса',
        variant: 'destructive',
      });
      return;
    }
    setCreatingCourse(true);
    try {
      const created = await api.courses.create({
        course_name: name,
      });
      setCourseName('');
      setShowCourseForm(false);
      await onRefresh();
      if (created?.id) {
        setExpandedCourses((prev) => new Set(prev).add(created.id));
        onSelectFolder({ courseId: created.id, folderId: null });
      }
      toast({ title: 'Курс создан', description: name });
    } catch (err) {
      toast({
        title: 'Не удалось создать курс',
        description: err.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setCreatingCourse(false);
    }
  };

  const deleteCourse = async (course) => {
    const name = getCourseDisplayName(course);
    if (
      !confirm(
        `Удалить курс «${name}»?\n\nБудут удалены:\n- папки курса;\n- материалы курса;\n- настройки доступа курса.\n\nЭто действие нельзя отменить.`,
      )
    ) {
      return;
    }
    setDeletingCourseId(course.id);
    setBusy(true);
    try {
      await api.courses.delete(course.id);
      if (selectedCourseId === course.id) {
        onSelectFolder({ courseId: null, folderId: null });
      }
      await onRefresh();
      toast({
        title: 'Курс удалён',
        description: `«${name}» скрыт из каталога материалов.`,
      });
    } catch (err) {
      toast({
        title: 'Не удалось удалить курс',
        description: err.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setDeletingCourseId(null);
    }
  };

  const persistOrder = async (items, updater) => {
    setReordering(true);
    try {
      await Promise.all(
        items.map((item, index) => updater(item, index)),
      );
      await onRefresh();
    } catch (err) {
      toast({
        title: 'Не удалось сохранить порядок',
        description: err?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
      await onRefresh();
    } finally {
      setReordering(false);
    }
  };

  const onDragEnd = async (result) => {
    if (!canManage || !result.destination) return;
    const { source, destination, type, draggableId } = result;
    if (
      source.droppableId === destination.droppableId
      && source.index === destination.index
    ) {
      return;
    }

    if (type === 'COURSE') {
      const next = Array.from(sortedCourses);
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      await persistOrder(next, (course, index) =>
        api.courses.update(course.id, { sort_order: index }),
      );
      return;
    }

    if (type.startsWith('FOLDER:')) {
      const listId = source.droppableId;
      if (listId !== destination.droppableId) {
        toast({
          title: 'Перенос между уровнями пока не поддерживается',
          description: 'Меняйте порядок папок внутри одного уровня.',
        });
        return;
      }

      let siblings = [];
      if (listId.startsWith('course-roots:')) {
        const courseId = listId.slice('course-roots:'.length);
        siblings = sortFolders(
          folders.filter((f) => f.course_id === courseId && !parentKey(f)),
        );
      } else if (listId.startsWith('folder-children:')) {
        const parentId = listId.slice('folder-children:'.length);
        siblings = sortFolders(folders.filter((f) => parentKey(f) === parentId));
      } else {
        return;
      }

      const next = Array.from(siblings);
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      await persistOrder(next, (folder, index) =>
        api.materials.folders.update(folder.id, { sort_order: index }),
      );
      return;
    }

    void draggableId;
  };

  const renderCourseBody = (course, courseIndex, dragHandleProps, snapshotDragging) => (
    <CourseBody
      course={course}
      courseIndex={courseIndex}
      dragHandleProps={dragHandleProps}
      snapshotDragging={snapshotDragging}
      folders={folders}
      countByCourse={countByCourse}
      selectedCourseId={selectedCourseId}
      selectedFolderId={selectedFolderId}
      expanded={expandedCourses.has(course.id)}
      isDeleting={deletingCourseId === course.id}
      addingFolderFor={addingFolderFor}
      folderName={folderName}
      setFolderName={setFolderName}
      busy={busy}
      canManage={canManage}
      enableDrag={enableDrag}
      canReceiveMaterials={canReceiveMaterials}
      onDropMaterials={onDropMaterials}
      onSelectFolder={onSelectFolder}
      onRefresh={onRefresh}
      toggleCourse={toggleCourse}
      setExpandedCourses={setExpandedCourses}
      setAddingFolderFor={setAddingFolderFor}
      createRootFolder={createRootFolder}
      deleteCourse={deleteCourse}
    />
  );

  const courseList = sortedCourses.map((course, courseIndex) => {
    if (!enableDrag) {
      return (
        <div key={course.id}>
          {renderCourseBody(course, courseIndex, null, false)}
        </div>
      );
    }

    return (
      <Draggable
        key={course.id}
        draggableId={`course:${course.id}`}
        index={courseIndex}
        isDragDisabled={!canManage}
      >
        {(dragProvided, snapshot) => (
          <div
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
          >
            {renderCourseBody(
              course,
              courseIndex,
              dragProvided.dragHandleProps,
              snapshot.isDragging,
            )}
          </div>
        )}
      </Draggable>
    );
  });

  return (
    <aside
      className="w-full lg:w-80 shrink-0 border border-border rounded-xl bg-card overflow-hidden flex flex-col max-h-[50vh] lg:max-h-[70vh]"
      data-testid="materials-course-tree"
    >
      <div className="px-3 py-2.5 border-b border-border bg-muted/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Курсы {reordering ? '· сохранение…' : ''}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCourseForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
              data-testid="materials-create-course"
            >
              <Plus className="h-3 w-3" />
              Создать курс
            </button>
          )}
        </div>
        {canManage && (
          <p className="text-[10px] text-muted-foreground">
            Перетаскивайте курсы и папки за иконку ⋮⋮ чтобы менять порядок
          </p>
        )}
        {canReceiveMaterials && (
          <p className="text-[10px] text-muted-foreground">
            Перетащите материалы из таблицы на курс или папку, чтобы переместить
          </p>
        )}

        {canManage && showCourseForm && (
          <div className="space-y-2 rounded-lg border border-border bg-background p-2">
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Название курса *"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              data-testid="materials-course-name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createCourse();
                }
              }}
            />
            <div className="flex gap-1">
              <button
                type="button"
                disabled={creatingCourse}
                onClick={createCourse}
                className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                data-testid="materials-course-save"
              >
                {creatingCourse ? 'Создание…' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCourseForm(false);
                  setCourseName('');
                }}
                className="rounded-md border border-border px-2 py-1.5 text-xs"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
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

        {sortedCourses.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground text-center">
            {canManage
              ? 'Курсов пока нет. Нажмите «Создать курс» выше.'
              : 'Курсов пока нет.'}
          </p>
        )}

        {enableDrag ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="courses" type="COURSE">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {courseList}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="space-y-1">{courseList}</div>
        )}
      </div>
    </aside>
  );
}
