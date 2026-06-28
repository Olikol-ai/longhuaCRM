import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, FileText, Video, Link, File, CheckCircle2, Loader2 } from "lucide-react";

const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500" },
  pptx: { icon: FileText, color: "text-orange-500" },
  video: { icon: Video, color: "text-blue-500" },
  link: { icon: Link, color: "text-indigo-500" },
  other: { icon: File, color: "text-slate-500" },
};

export default function MaterialPickerDialog({ onConfirm, onSkip, onCancel, lessonInfo }) {
  const [materials, setMaterials] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.LessonMaterial.list("-created_date", 200).then(m => {
      setMaterials(m);
      setLoading(false);
    });
  }, []);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = materials.filter(m =>
    (m.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.block_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Прикрепить материалы</h3>
            <p className="text-xs text-slate-400 mt-0.5">К уроку: {lessonInfo}</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Поиск материалов..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">Материалы не найдены</p>
          ) : (
            filtered.map(mat => {
              const typeInfo = FILE_TYPE_ICONS[mat.file_type] || FILE_TYPE_ICONS.other;
              const IconComp = typeInfo.icon;
              const isSelected = selected.includes(mat.id);
              return (
                <button
                  key={mat.id}
                  onClick={() => toggle(mat.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <IconComp className={`h-4 w-4 shrink-0 ${typeInfo.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{mat.title}</p>
                    {mat.block_name && <p className="text-xs text-slate-400">{mat.block_name}</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600">
            Пропустить
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Отмена</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
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