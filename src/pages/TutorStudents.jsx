import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getGreetingName } from '@/lib/display-name';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Phone, Search, Users, MessageCircle } from 'lucide-react';

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function formatTelegram(student) {
  const username = String(student.telegram_username || '').trim().replace(/^@/, '');
  if (username) return `@${username}`;
  return '';
}

function studentMatchesQuery(student, query) {
  if (!query) return true;
  const haystack = [
    student.name,
    student.first_name,
    student.last_name,
    student.phone,
    student.email,
  ]
    .filter(Boolean)
    .map((v) => normalizeSearch(v))
    .join(' ');
  return haystack.includes(query);
}

export default function TutorStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      // ACL: GET /students already scopes tutors to assigned_tutor_id.
      const rows = await api.students.list();
      const visible = (Array.isArray(rows) ? rows : []).filter(
        (s) => s.status !== 'inactive',
      );
      setStudents(visible);
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить учеников');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return [...students]
      .filter((s) => studentMatchesQuery(s, q))
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
          sensitivity: 'base',
        }),
      );
  }, [students, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Мои ученики</h1>
        <p className="text-sm text-slate-500 mt-1">
          {getGreetingName(user)}, здесь только ученики, закреплённые за вами
        </p>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск ученика..."
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Users className="w-4 h-4" />
        {filtered.length} учеников
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">Ученики не найдены</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s) => {
            const tg = formatTelegram(s);
            return (
              <Card key={s.id} className="p-4 space-y-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                {s.email && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {s.email}
                  </p>
                )}
                {s.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {s.phone}
                  </p>
                )}
                {tg && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> {tg}
                  </p>
                )}
                <div className="pt-1">
                  <Button variant="outline" size="sm" onClick={loadData}>Обновить</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
