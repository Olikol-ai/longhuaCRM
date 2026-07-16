import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from '@/api';
import {
  Users, GraduationCap, Shield, Trash2, Search,
  ChevronDown, Loader2, X, Plus, Pencil, Eye, CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import TeacherFormDialog from "@/components/teachers/TeacherFormDialog";
import TeacherDetailModal from "@/components/teachers/TeacherDetailModal";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import { toast } from "@/components/ui/use-toast";
import {
  ALL_ROLE_OPTIONS,
  ACCOUNT_FILTER_TABS,
  ROLE_CONFIG,
  displayRole,
  showOrphanStudentsNotice,
  visibleStudents,
  visibleTeachers,
} from "./userManagement.constants";
import { resolveAssignedTeacherLabel } from "@/lib/teacherLabels";

const showOrphanNotice = (result) => showOrphanStudentsNotice(result, toast);

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// Dropdown using portal so it never clips
function RoleDropdown({ userId, currentRole, onChangeRole, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const options = ALL_ROLE_OPTIONS.filter(r => r !== currentRole);

  const handleOpen = () => {
    if (disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = options.length * 44 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight
      ? rect.bottom + 4
      : rect.top - menuHeight - 4;
    const left = Math.min(rect.left, window.innerWidth - 180);
    setPos({ top, left });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
      >
        Сменить роль <ChevronDown className="w-3 h-3" />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[101] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden min-w-[180px]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="px-3 py-2 border-b border-slate-50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Выбрать роль</p>
            </div>
            {options.map(role => {
              const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
              const Icon = cfg.icon;
              return (
                <button
                  key={role}
                  onClick={() => { onChangeRole(userId, role); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function ConfirmDeleteModal({ user, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-slate-800 text-center mb-1">Удалить пользователя?</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          <span className="font-semibold text-slate-700">{
            user.first_name && user.last_name 
              ? `${user.last_name} ${user.first_name}`
              : user.full_name || user.email
          }</span> будет удалён безвозвратно.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Отмена
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
            Удалить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tab: Accounts ─────────────────────────────────────────────────────────────
function AccountsTab({ entries, loading, onReload, onRoleChange }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updating, setUpdating] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const changeRole = async (userId, newRole) => {
    setUpdating(userId);
    try {
      await onRoleChange(userId, newRole);
    } finally {
      setUpdating(null);
    }
  };

  const deleteUser = async (u) => {
    setUpdating(u.id);
    setDeleteConfirm(null);
    try {
      const result = await api.users.delete(u.id);
      showOrphanNotice(result);
      await onReload();
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert(err?.message || "Не удалось удалить пользователя");
    } finally {
      setUpdating(null);
    }
  };

  const FILTER_TABS = ACCOUNT_FILTER_TABS;
  const activeFilter = FILTER_TABS.some((tab) => tab.value === roleFilter)
    ? roleFilter
    : "all";

  const pendingCount = entries.filter((u) => displayRole(u.role) === "pending").length;

  const getFullName = (entry) => {
    if (entry.first_name && entry.last_name) {
      return `${entry.last_name} ${entry.first_name}`;
    }
    return entry.full_name || entry.email || "Unknown";
  };

  const filtered = entries.filter((u) => {
    const role = displayRole(u.role);
    const matchRole = activeFilter === "all" || role === activeFilter;
    const fullName = getFullName(u);
    const matchSearch = !search ||
      fullName.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filter pills: Все / Ожидают роли (entity lists live on top-level tabs) */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(tab => {
          const count = tab.value === "all" ? entries.length : pendingCount;
          const active = activeFilter === tab.value;
          const cfg = tab.value === "pending" ? ROLE_CONFIG.pending : null;
          return (
            <button key={tab.value} onClick={() => setRoleFilter(tab.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                active
                  ? (cfg ? `${cfg.bg} ${cfg.text} border-transparent` : "bg-slate-800 text-white border-transparent")
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${active ? "bg-white/30" : "bg-slate-100 text-slate-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или email..."
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Пользователи не найдены</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((u) => {
              const role = displayRole(u.role);
              const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
              const displayName = getFullName(u);
              const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
              const isUpd = updating === u.id;
              const hasAccount = u.has_account !== false;
              const rowKey = hasAccount ? u.id : `${u.entry_type}:${u.id}`;
              return (
                <div key={rowKey} className={`bg-white rounded-2xl border border-slate-100 p-4 ${isUpd ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{displayName}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{u.email || "—"}</p>
                      {!hasAccount && (
                        <p className="text-[11px] text-amber-600 font-medium mt-0.5">Профиль без аккаунта</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RoleBadge role={role} />
                        {u.created_date && (
                          <span className="text-[11px] text-slate-400">
                            {new Date(u.created_date).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
                    </div>
                    {isUpd && <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap items-center gap-2">
                    {hasAccount ? (
                      <>
                        <RoleDropdown userId={u.id} currentRole={role} onChangeRole={changeRole} disabled={isUpd} />
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(u)}
                          disabled={isUpd}
                          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Удалить
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Назначьте роль через регистрацию</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Пользователь</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Роль</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Дата</th>
                  <th className="px-5 py-3.5 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const role = displayRole(u.role);
                  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
                  const displayName = getFullName(u);
                  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                  const isUpd = updating === u.id;
                  const hasAccount = u.has_account !== false;
                  const rowKey = hasAccount ? u.id : `${u.entry_type}:${u.id}`;
                  return (
                    <tr key={rowKey} className={`border-b border-slate-50 last:border-0 ${isUpd ? "opacity-60" : "hover:bg-slate-50/50"} transition-colors`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{displayName}</p>
                            {!hasAccount && (
                              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Профиль без аккаунта</p>
                            )}
                          </div>
                          {isUpd && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{u.email || "—"}</td>
                      <td className="px-5 py-3.5"><RoleBadge role={role} /></td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs hidden lg:table-cell">
                        {u.created_date ? new Date(u.created_date).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasAccount ? (
                          <div className="flex items-center justify-end gap-2">
                            <RoleDropdown userId={u.id} currentRole={role} onChangeRole={changeRole} disabled={isUpd} />
                            <button type="button" onClick={() => setDeleteConfirm(u)} disabled={isUpd}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Назначьте роль через регистрацию</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deleteConfirm && (
        <ConfirmDeleteModal user={deleteConfirm} onConfirm={() => deleteUser(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      )}
    </div>
  );
}

// ─── Tab: Students ─────────────────────────────────────────────────────────────
function StudentsTab({ students, teachers, loading, onReload }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const STATUS_STYLE = {
    active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-slate-50 text-slate-500 border-slate-200",
    paused:   "bg-amber-50 text-amber-700 border-amber-200",
  };
  const STATUS_LABEL = { active: "Активен", inactive: "Неактивен", paused: "Пауза" };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await api.students.delete(deleteTarget.id);
      showOrphanNotice(result);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      console.error("Failed to delete student:", err);
      alert(err?.message || "Не удалось удалить ученика");
    } finally {
      setDeleting(false);
    }
  };

  const getTeacherName = (id) => resolveAssignedTeacherLabel(id, teachers);

  const filtered = students.filter(s =>
    (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск учеников..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>
        <div className="flex items-center gap-3 justify-between sm:justify-end sm:ml-auto">
          <span className="text-sm text-slate-400">{students.length} учеников</span>
          <button type="button" onClick={() => { setEditStudent(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">Ученики не найдены</div>
            ) : filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{(s.name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{s.email || "—"}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">Преподаватель: {getTeacherName(s.assigned_teacher)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-sm font-bold ${(s.lesson_balance || 0) <= 0 ? "text-red-600" : (s.lesson_balance || 0) <= 2 ? "text-amber-600" : "text-slate-800"}`}>
                        Баланс: {(s.lesson_balance || 0) <= 0 && "⚠️ "}{s.lesson_balance || 0}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_STYLE[s.status] || STATUS_STYLE.active}`}>
                        {STATUS_LABEL[s.status] || "Активен"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                  <Link to={createPageUrl("StudentDetail") + `?id=${s.id}`} className="flex-1 min-w-[7rem]">
                    <button type="button" className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100">
                      <Eye className="w-3.5 h-3.5" /> Просмотр
                    </button>
                  </Link>
                  <button type="button" onClick={() => { setEditStudent(s); setShowForm(true); }}
                    className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100">
                    <Pencil className="w-3.5 h-3.5" /> Изменить
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(s)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Имя</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Преподаватель</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Баланс</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Статус</th>
                  <th className="px-5 py-3.5 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-600">{(s.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{s.email || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{getTeacherName(s.assigned_teacher)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-sm font-bold ${(s.lesson_balance || 0) <= 0 ? "text-red-600" : (s.lesson_balance || 0) <= 2 ? "text-amber-600" : "text-slate-800"}`}>
                        {(s.lesson_balance || 0) <= 0 && "⚠️ "}{s.lesson_balance || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_STYLE[s.status] || STATUS_STYLE.active}`}>
                        {STATUS_LABEL[s.status] || "Активен"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={createPageUrl("StudentDetail") + `?id=${s.id}`}>
                          <button type="button" className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Просмотр">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button type="button" onClick={() => { setEditStudent(s); setShowForm(true); }}
                          className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Редактировать">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(s)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Ученики не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Удалить ученика"
          description={`Вы уверены, что хотите удалить «${deleteTarget.name}»? Все уроки будут удалены.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
      <StudentFormDialog open={showForm} onOpenChange={setShowForm} student={editStudent} onSave={onReload} />
    </div>
  );
}

// ─── Tab: Teachers ─────────────────────────────────────────────────────────────
function TeachersTab({ teachers, students, loading, onReload }) {
  const [lessons, setLessons] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTeacher, setViewTeacher] = useState(null);

  useEffect(() => {
    api.lessons.list().then(setLessons).catch(() => setLessons([]));
  }, [teachers]);

  const hasActiveLessons = (id) => lessons.some(l => l.teacher_id === id && l.status === "planned");

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await api.teachers.delete(deleteTarget.id);
      showOrphanNotice(result);
      setDeleteTarget(null);
      await onReload();
    } catch (err) {
      console.error("Failed to delete teacher:", err);
      alert(err?.message || "Не удалось удалить преподавателя");
    } finally {
      setDeleting(false);
    }
  };

  const getStudentCount = (id) => students.filter(s => s.assigned_teacher === id && s.status === "active").length;
  const filtered = teachers.filter(t => (t.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск преподавателей..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>
        <div className="flex items-center gap-3 justify-between sm:justify-end sm:ml-auto">
          <span className="text-sm text-slate-400">{teachers.length} преподавателей</span>
          <button type="button" onClick={() => { setEditTeacher(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">Преподаватели не найдены</div>
            ) : filtered.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                <button type="button" className="w-full text-left" onClick={() => setViewTeacher(t)}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-600">{(t.name || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{t.email}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">{t.specializations || "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-slate-700">{t.hourly_rate || 0} BYN/ч</span>
                        <span className="text-slate-500">Ученики: {getStudentCount(t.id)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${t.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                          {t.status === "active" ? <><CheckCircle2 className="w-3 h-3" /> Активен</> : "Неактивен"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setViewTeacher(t)}
                    className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100">
                    <Eye className="w-3.5 h-3.5" /> Просмотр
                  </button>
                  <button type="button" onClick={() => { setEditTeacher(t); setShowForm(true); }}
                    className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100">
                    <Pencil className="w-3.5 h-3.5" /> Изменить
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(t)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Имя</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Специализация</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ставка</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ученики</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Статус</th>
                  <th className="px-5 py-3.5 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setViewTeacher(t)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-600">{(t.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{t.name}</p>
                          <p className="text-xs text-slate-400 truncate">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{t.specializations || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{t.hourly_rate || 0} BYN/ч</td>
                    <td className="px-5 py-3.5 text-slate-700">{getStudentCount(t.id)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${t.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {t.status === "active" ? <><CheckCircle2 className="w-3 h-3" /> Активен</> : "Неактивен"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditTeacher(t); setShowForm(true); }}
                          className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Редактировать">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Преподаватели не найдены</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Удалить преподавателя"
          description={hasActiveLessons(deleteTarget.id)
            ? `У «${deleteTarget.name}» есть активные уроки.`
            : `Удалить «${deleteTarget.name}»?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
      {viewTeacher && (
        <TeacherDetailModal
          teacher={viewTeacher}
          students={students}
          onEdit={(t) => { setViewTeacher(null); setEditTeacher(t); setShowForm(true); }}
          onDelete={(id) => { setViewTeacher(null); setDeleteTarget(teachers.find(t => t.id === id)); }}
          onClose={() => setViewTeacher(null)}
        />
      )}
      <TeacherFormDialog open={showForm} onOpenChange={setShowForm} teacher={editTeacher} onSave={onReload} />
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "accounts", label: "Аккаунты", icon: Shield },
  { id: "students", label: "Ученики", icon: Users },
  { id: "teachers", label: "Преподаватели", icon: GraduationCap },
];

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [directoryEntries, setDirectoryEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const loadGenerationRef = useRef(0);

  const accountUsers = directoryEntries.filter((entry) => entry.has_account !== false);

  const loadAll = async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setLoading(true);
    setLoadError("");
    try {
      const [directory, s, t] = await Promise.all([
        api.users.directory(),
        api.students.list("-created_date"),
        api.teachers.list("-created_date"),
      ]);
      if (loadGenerationRef.current !== generation) {
        return;
      }
      setDirectoryEntries(Array.isArray(directory) ? directory : []);
      setStudents(Array.isArray(s) ? s : []);
      setTeachers(Array.isArray(t) ? t : []);
    } catch (err) {
      if (loadGenerationRef.current !== generation) {
        return;
      }
      console.error("Failed to load user management data:", err);
      setLoadError(err?.message || "Не удалось загрузить данные");
    } finally {
      if (loadGenerationRef.current === generation) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.users.update(userId, { role: newRole, status: "active" });
      await loadAll();
      toast({
        title: "Роль обновлена",
        description: `Пользователю назначена роль «${ROLE_CONFIG[newRole]?.label || newRole}»`,
      });
    } catch (err) {
      console.error("Failed to change user role:", err);
      toast({
        title: "Не удалось сменить роль",
        description: err?.message || "Повторите попытку",
        variant: "destructive",
      });
      throw err;
    }
  };

  const displayStudents = visibleStudents(students, accountUsers);
  const displayTeachers = visibleTeachers(teachers, accountUsers);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Пользователи</h1>
        <p className="text-sm text-slate-500 mt-1">Управление аккаунтами, учениками и преподавателями</p>
        {loadError && (
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
        )}
      </div>

      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-max min-w-full sm:min-w-0 sm:w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}>
                <Icon className="w-4 h-4 shrink-0" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "accounts" && (
        <AccountsTab
          entries={directoryEntries}
          loading={loading}
          onReload={loadAll}
          onRoleChange={handleRoleChange}
        />
      )}
      {activeTab === "students" && (
        <StudentsTab
          students={displayStudents}
          teachers={displayTeachers}
          loading={loading}
          onReload={loadAll}
        />
      )}
      {activeTab === "teachers" && (
        <TeachersTab
          teachers={displayTeachers}
          students={displayStudents}
          loading={loading}
          onReload={loadAll}
        />
      )}
    </div>
  );
}