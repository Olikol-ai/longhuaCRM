import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { revokeAccess } from "@/lib/materialAccess";
import { Users, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AccessManageModal({ closeTab }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accesses, setAccesses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const me = await api.auth.me();
    setUser(me);

    const [sts, trs, mats, accs] = await Promise.all([
      api.entities.Student.list(),
      api.entities.Teacher.list(),
      api.entities.LessonMaterial.list(),
      api.entities.MaterialAccess.list(),
    ]);

    setStudents(sts);
    setTeachers(trs);
    setMaterials(mats);
    setAccesses(accs.filter(a => a.access === true)); // Показываем только активные доступы
    setLoading(false);
  };

  const getMaterialTitle = (matId) => {
    const mat = materials.find(m => m.id === matId);
    return mat?.title || "Неизвестный материал";
  };

  const getUsersWithAccess = () => {
    const usersMap = new Map();

    accesses.forEach(acc => {
      const student = students.find(s => s.user_id === acc.user_id);
      const teacher = teachers.find(t => t.user_id === acc.user_id);

      const userData = student || teacher;
      if (userData) {
        const userType = student ? "student" : "teacher";
        const key = `${userType}_${acc.user_id}`;

        if (!usersMap.has(key)) {
          usersMap.set(key, {
            type: userType,
            userId: acc.user_id,
            name: userData.name,
            email: userData.email,
            materials: [],
          });
        }
        usersMap.get(key).materials.push({
          accessId: acc.id,
          materialId: acc.material_id,
          title: getMaterialTitle(acc.material_id),
          grantedByRole: acc.granted_by_role,
        });
      }
    });

    return Array.from(usersMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  };

  const handleRemoveAccess = async (materialId, userId, grantedByRole) => {
    if (!confirm("Забрать доступ к этому материалу?")) return;

    setDeleting(materialId);
    try {
      await revokeAccess(userId, materialId, grantedByRole);
      await loadData();
    } catch (err) {
      console.error("Remove access error:", err);
      alert("Ошибка при удалении доступа");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const usersWithAccess = getUsersWithAccess();

  return (
    <div className="space-y-4">
      {usersWithAccess.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Пользователи без доступа к материалам</p>
        </Card>
      ) : (
        usersWithAccess.map(userAccess => (
          <Card
            key={`${userAccess.type}_${userAccess.userId}`}
            className="p-4 border border-slate-200"
          >
            <button
              onClick={() =>
                setExpandedUser(
                  expandedUser === `${userAccess.type}_${userAccess.userId}`
                    ? null
                    : `${userAccess.type}_${userAccess.userId}`
                )
              }
              className="w-full flex items-center justify-between hover:bg-slate-50 -m-4 p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-700">
                    {userAccess.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{userAccess.name}</p>
                  <p className="text-xs text-slate-500">{userAccess.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {userAccess.materials.length} материал{
                      userAccess.materials.length % 10 === 1 ? "" : "ов"
                    }
                  </p>
                </div>
              </div>
              {expandedUser === `${userAccess.type}_${userAccess.userId}` ? (
                <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
              )}
            </button>

            {expandedUser === `${userAccess.type}_${userAccess.userId}` && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                {userAccess.materials.map(mat => (
                  <div
                    key={mat.materialId}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {mat.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        Выдано: {mat.grantedByRole === "ADMIN" ? "Администратором" : "Учителем"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleRemoveAccess(mat.materialId, userAccess.userId, mat.grantedByRole)
                      }
                      disabled={deleting === mat.materialId}
                      className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                      title="Забрать доступ"
                    >
                      {deleting === mat.materialId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}