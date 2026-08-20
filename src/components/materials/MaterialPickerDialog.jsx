import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, CheckCircle2, Loader2 } from "lucide-react";
import { getMaterialTypeInfo } from "@/lib/materialIcons";
import { resolveMaterialDisplayTitle, unpackMaterialDescription } from "@/lib/materialMeta";

export default function MaterialPickerDialog({ onConfirm, onSkip, onCancel, lessonInfo }) {
  const [materials, setMaterials] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.materials.list("-created_date", 200).then(m => {
      setMaterials(m);
      setLoading(false);
    });
  }, []);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = materials.filter((m) => {
    const block = unpackMaterialDescription(m.description).blockName;
    const q = search.toLowerCase();
    const title = resolveMaterialDisplayTitle(m).toLowerCase();
    return title.includes(q) || block.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80vh] border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Прикрепить материалы</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">К уроку: {lessonInfo}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-touch min-w-touch inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Поиск материалов..." className="pl-10 min-h-touch" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Материалы не найдены</p>
          ) : (
            filtered.map((mat) => {
              const typeInfo = getMaterialTypeInfo(mat);
              const IconComp = typeInfo.icon;
              const isSelected = selected.includes(mat.id);
              const block = unpackMaterialDescription(mat.description).blockName;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => toggle(mat.id)}
                  className={`w-full flex items-center gap-3 p-3 min-h-touch rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-brand/40 bg-brand-soft dark:bg-brand-soft/30"
                      : "border-border hover:border-brand/30 hover:bg-muted"
                  }`}
                >
                  <IconComp className={`h-4 w-4 shrink-0 ${typeInfo.color}`} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-foreground truncate"
                      title={resolveMaterialDisplayTitle(mat)}
                    >
                      {resolveMaterialDisplayTitle(mat)}
                    </p>
                    {block && <p className="text-xs text-muted-foreground truncate">{block}</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-touch text-sm text-muted-foreground hover:text-foreground"
          >
            Пропустить
          </button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 sm:flex-none min-h-touch" onClick={onCancel}>Отмена</Button>
            <Button
              className="flex-1 sm:flex-none min-h-touch bg-primary hover:bg-primary/90"
              onClick={() => onConfirm(selected)}
            >
              Завершить урок
              {selected.length > 0 && <span className="ml-1.5 bg-white/20 rounded-full px-1.5 text-xs">{selected.length}</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
