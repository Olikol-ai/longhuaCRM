import { useState, useEffect } from "react";
import { api } from '@/api';
import { Plus, Pencil, Trash2, Save, X, Package, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

const fieldCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const DEFAULT_PACKAGES = [
  { item_id: "single", label: "1 занятие", lessons: 1, price: 25, note: "", type: "package", sort_order: 0, is_active: true },
  { item_id: "pack_4", label: "4 занятия", lessons: 4, price: 90, note: "10% скидка", type: "package", sort_order: 1, is_active: true },
  { item_id: "pack_8", label: "8 занятий", lessons: 8, price: 170, note: "Популярный выбор", type: "package", sort_order: 2, is_active: true },
  { item_id: "pack_12", label: "12 занятий", lessons: 12, price: 240, note: "Лучшая цена", type: "package", sort_order: 3, is_active: true },
];
const DEFAULT_COURSES = [
  { item_id: "course_basic", label: "Начальный базовый", lessons: 35, price: 0, note: "", description: "Для начинающих с нуля · 35 уроков × 1 час", type: "course", sort_order: 0, is_active: true },
  { item_id: "course_adv_beginner", label: "Начальный продвинутый", lessons: 35, price: 0, note: "", description: "Для тех, кто знает основы · 35 уроков × 1 час", type: "course", sort_order: 1, is_active: true },
  { item_id: "course_advanced", label: "Продвинутый", lessons: 35, price: 0, note: "", description: "Углублённое изучение · 35 уроков × 1 час", type: "course", sort_order: 2, is_active: true },
];

const EMPTY_PKG = { item_id: "", label: "", lessons: 1, price: 0, note: "", type: "package", sort_order: 99, is_active: true };
const EMPTY_COURSE = { item_id: "", label: "", lessons: 35, price: 0, note: "", description: "", type: "course", sort_order: 99, is_active: true };

export default function ShopSettingsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("package");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    const data = await api.payments.shopItems.list("sort_order");
    if (data.length === 0) {
      // seed defaults
      await Promise.all([...DEFAULT_PACKAGES, ...DEFAULT_COURSES].map(d => api.payments.shopItems.create(d)));
      const fresh = await api.payments.shopItems.list("sort_order");
      setItems(fresh);
    } else {
      setItems(data);
    }
    setLoading(false);
  };

  const filtered = items.filter(i => i.type === tab);

  const startAdd = () => setEditing({ ...(tab === "package" ? EMPTY_PKG : EMPTY_COURSE), _new: true });

  const handleSave = async () => {
    if (!editing.label && !editing.name) return;
    if (!editing.item_id && editing._new) return;
    setSaving(true);
    const { _new, ...data } = editing;
    const payload = {
      ...data,
      label: data.label || data.name,
      name: data.label || data.name,
    };
    if (editing._new) {
      await api.payments.shopItems.create(payload);
    } else {
      await api.payments.shopItems.update(editing.id, payload);
    }
    setEditing(null);
    setSaving(false);
    loadItems();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить этот элемент?")) return;
    await api.payments.shopItems.delete(id);
    loadItems();
  };

  const toggleActive = async (item) => {
    await api.payments.shopItems.update(item.id, { is_active: !item.is_active });
    loadItems();
  };

  const set = (k, v) => setEditing(e => ({ ...e, [k]: v }));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
          <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Настройка магазина</h2>
          <p className="text-sm text-muted-foreground">Редактирование абонементов и курсов</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit mb-4">
        {[["package", Package, "Абонементы"], ["course", GraduationCap, "Курсы"]].map(([t, TabIcon, label]) => (
          <button key={t} onClick={() => setTab(String(t))}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "package" ? <Package className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <Card key={item.id} className={`p-4 flex items-center gap-4 ${!item.is_active ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{item.name || item.label}</span>
                  {item.note && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{item.note}</span>}
                  {!item.is_active && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">скрыт</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{item.lessons} уроков</span>
                  {item.price > 0 && <span>{formatCurrency(item.price)}</span>}
                  {item.description && <span className="truncate max-w-xs">{item.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(item)}
                  className={`px-2 py-1 text-xs rounded-lg border transition-colors ${item.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700"}`}>
                  {item.is_active ? "Вкл" : "Выкл"}
                </button>
                <button onClick={() => setEditing({ ...item })}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
          <button onClick={startAdd}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-500 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Добавить {tab === "package" ? "абонемент" : "курс"}
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-2xl w-full max-w-md shadow-xl border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">{editing._new ? "Добавить" : "Редактировать"} {tab === "package" ? "абонемент" : "курс"}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-muted rounded-lg">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">ID (уникальный, без пробелов) *</label>
                <input value={editing.item_id} onChange={e => set("item_id", e.target.value)}
                  placeholder="pack_4" className={`${fieldCls} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Название *</label>
                <input value={editing.label} onChange={e => set("label", e.target.value)}
                  placeholder="4 занятия" className={fieldCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Кол-во уроков *</label>
                  <input type="number" value={editing.lessons} onChange={e => set("lessons", +e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Цена (BYN)</label>
                  <input type="number" value={editing.price} onChange={e => set("price", +e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Заметка (промо)</label>
                <input value={editing.note || ""} onChange={e => set("note", e.target.value)}
                  placeholder="10% скидка" className={fieldCls} />
              </div>
              {tab === "course" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Описание курса</label>
                  <textarea value={editing.description || ""} onChange={e => set("description", e.target.value)}
                    rows={2} placeholder="Для начинающих · 35 уроков × 1 час"
                    className={`${fieldCls} resize-none`} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Порядок отображения</label>
                <input type="number" value={editing.sort_order} onChange={e => set("sort_order", +e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg">Отмена</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                <Save className="w-4 h-4" /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}