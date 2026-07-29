import { BookOpen, ClipboardCheck, FileText, GraduationCap } from 'lucide-react';

const CARD_META = {
  lesson: { title: 'Урок', icon: BookOpen },
  homework: { title: 'Домашнее задание', icon: ClipboardCheck },
  exam: { title: 'Экзамен', icon: GraduationCap },
  material: { title: 'Материал', icon: FileText },
};

export default function CrmMessageCard({ message }) {
  const meta = CARD_META[message.type] || CARD_META.material;
  const Icon = meta.icon;
  return (
    <div className="mt-1 flex max-w-md items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
      <div className="rounded bg-brand-soft p-2 text-brand"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{meta.title}</p>
        <p className="truncate text-sm font-medium">{message.body || message.refEntityType || 'Открыть в CRM'}</p>
      </div>
    </div>
  );
}
