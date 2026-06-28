import { useState, useEffect } from "react";
import { api } from '@/api';
import { X, BookOpen, CheckCircle2, GraduationCap, Loader2, CreditCard } from "lucide-react";

const FALLBACK_PACKAGES = [
  { item_id: "single", label: "1 занятие", lessons: 1, price: 25, note: null, type: "package", is_active: true },
  { item_id: "pack_4", label: "4 занятия", lessons: 4, price: 90, note: "10% скидка", type: "package", is_active: true },
  { item_id: "pack_8", label: "8 занятий", lessons: 8, price: 170, note: "Популярный выбор", type: "package", is_active: true },
  { item_id: "pack_12", label: "12 занятий", lessons: 12, price: 240, note: "Лучшая цена", type: "package", is_active: true },
];
const FALLBACK_COURSES = [
  { item_id: "course_basic", label: "Начальный базовый", lessons: 35, description: "Для начинающих с нуля · 35 уроков × 1 час", type: "course", is_active: true },
  { item_id: "course_adv_beginner", label: "Начальный продвинутый", lessons: 35, description: "Для тех, кто знает основы · 35 уроков × 1 час", type: "course", is_active: true },
  { item_id: "course_advanced", label: "Продвинутый", lessons: 35, description: "Углублённое изучение · 35 уроков × 1 час", type: "course", is_active: true },
];

export default function BuyLessonsModal({ onClose }) {
  const [tab, setTab] = useState("packages");
  const [selected, setSelected] = useState(null);
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShopItems();
  }, []);

  const loadShopItems = async () => {
    try {
      const items = await api.entities.ShopSettings.list("sort_order");
      const pkgs = items.filter(i => i.type === "package" && i.is_active !== false);
      const crs = items.filter(i => i.type === "course" && i.is_active !== false);
      setPackages(pkgs.length > 0 ? pkgs : FALLBACK_PACKAGES);
      setCourses(crs.length > 0 ? crs : FALLBACK_COURSES);
    } catch {
      setPackages(FALLBACK_PACKAGES);
      setCourses(FALLBACK_COURSES);
    }
    setLoading(false);
  };

  const items = tab === "packages" ? packages : courses;
  const selectedItem = items.find(i => i.item_id === selected);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800">Пополнить баланс</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[["packages", "Абонементы"], ["courses", "Курсы"]].map(([t, l]) => (
              <button key={t} onClick={() => { setTab(t); setSelected(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : tab === "packages" ? (
            packages.map(pkg => (
              <button key={pkg.item_id} onClick={() => setSelected(pkg.item_id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${selected === pkg.item_id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                <div className="flex items-center gap-3">
                  {selected === pkg.item_id
                    ? <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    : <BookOpen className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{pkg.label}</p>
                    {pkg.note && <p className="text-xs text-emerald-600 font-medium">{pkg.note}</p>}
                  </div>
                </div>
                {pkg.price > 0 && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{pkg.price} BYN</p>
                    <p className="text-xs text-slate-400">{(pkg.price / pkg.lessons).toFixed(0)} BYN/урок</p>
                  </div>
                )}
              </button>
            ))
          ) : (
            courses.map(course => (
              <button key={course.item_id} onClick={() => setSelected(course.item_id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${selected === course.item_id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                <div className="flex items-center gap-3">
                  {selected === course.item_id
                    ? <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    : <GraduationCap className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{course.label}</p>
                    <p className="text-xs text-slate-400">{course.description}</p>
                  </div>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <span className="text-sm font-bold text-indigo-600">{course.lessons} ур.</span>
                  {course.price > 0 && <p className="text-xs text-slate-500">{course.price} BYN</p>}
                </div>
              </button>
            ))
          )}
        </div>

        {selectedItem && (
          <div className="mx-6 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Как оплатить</p>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {selectedItem.price > 0
                ? <>Переведите <strong>{selectedItem.price} BYN</strong> через интернет-эквайринг или на расчётный счёт школы и сообщите об оплате администратору. Уроки будут начислены после подтверждения платежа.</>
                : <>Свяжитесь с администратором для оформления курса <strong>{selectedItem.label}</strong> ({selectedItem.lessons} уроков).</>
              }
            </p>
          </div>
        )}

        <div className="flex justify-end px-6 pb-5 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}