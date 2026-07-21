import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  canPublishBlueprint,
  emptyBlueprintSection,
  sumSectionWeights,
} from '@/lib/assessment-admin';

/**
 * Drag-and-drop editor for Blueprint section rules.
 */
export default function BlueprintSectionEditor({
  sections,
  onChange,
  readOnly = false,
}) {
  const totalWeight = sumSectionWeights(sections);
  const publishCheck = canPublishBlueprint(sections);
  const weightOk = Math.abs(totalWeight - 100) <= 0.01;

  const updateSection = (index, patch) => {
    onChange(
      sections.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.question_type !== undefined) {
          next.question_types = [patch.question_type];
        }
        return next;
      }),
    );
  };

  const addSection = () => {
    onChange([...sections, emptyBlueprintSection(sections.length)]);
  };

  const removeSection = (index) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const onDragEnd = (result) => {
    if (readOnly || !result.destination) return;
    if (result.destination.index === result.source.index) return;
    const next = Array.from(sections);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-4" data-testid="blueprint-section-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Секции</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Перетащите секции для изменения порядка
          </p>
        </div>
        <div
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
            weightOk
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          Суммарный вес: {totalWeight.toFixed(0)}%
        </div>
      </div>

      {!publishCheck.ok && sections.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{publishCheck.reason}</p>
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Секций пока нет — добавьте Аудирование, Чтение и т.д.
          </p>
          {!readOnly && (
            <Button type="button" variant="outline" onClick={addSection}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить секцию
            </Button>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="blueprint-sections" isDropDisabled={readOnly}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-3"
              >
                {sections.map((section, index) => (
                  <Draggable
                    key={section.local_id || section.id || `s-${index}`}
                    draggableId={String(section.local_id || section.id || `s-${index}`)}
                    index={index}
                    isDragDisabled={readOnly}
                  >
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`rounded-2xl border bg-white dark:bg-slate-900/80 p-4 space-y-3 ${
                          snapshot.isDragging
                            ? 'border-brand/40 shadow-lg'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab"
                            {...dragProvided.dragHandleProps}
                            aria-label="Перетащить"
                            disabled={readOnly}
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1 sm:col-span-2">
                              <Label>Название секции</Label>
                              <Input
                                value={section.title}
                                onChange={(e) =>
                                  updateSection(index, { title: e.target.value })
                                }
                                placeholder="Аудирование"
                                disabled={readOnly}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Тип вопросов</Label>
                              <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={
                                  section.question_type ||
                                  section.question_types?.[0] ||
                                  'single_choice'
                                }
                                onChange={(e) =>
                                  updateSection(index, {
                                    question_type: e.target.value,
                                  })
                                }
                                disabled={readOnly}
                              >
                                {QUESTION_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {QUESTION_TYPE_LABEL[t]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label>Количество</Label>
                              <Input
                                type="number"
                                min={1}
                                value={section.question_count}
                                onChange={(e) =>
                                  updateSection(index, {
                                    question_count: Number(e.target.value) || 1,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Вес (%)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={section.weight}
                                onChange={(e) =>
                                  updateSection(index, {
                                    weight: Number(e.target.value) || 0,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Сложность min–max</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={section.difficulty_min ?? 1}
                                  onChange={(e) =>
                                    updateSection(index, {
                                      difficulty_min: Number(e.target.value) || 1,
                                    })
                                  }
                                  disabled={readOnly}
                                />
                                <Input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={section.difficulty_max ?? 5}
                                  onChange={(e) =>
                                    updateSection(index, {
                                      difficulty_max: Number(e.target.value) || 5,
                                    })
                                  }
                                  disabled={readOnly}
                                />
                              </div>
                            </div>
                          </div>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-rose-500"
                              onClick={() => removeSection(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {!readOnly && sections.length > 0 && (
        <Button type="button" variant="outline" onClick={addSection}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить секцию
        </Button>
      )}
    </div>
  );
}
