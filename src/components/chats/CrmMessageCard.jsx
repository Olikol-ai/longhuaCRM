import { BookOpen, ClipboardCheck, FileText, GraduationCap } from 'lucide-react';
import { iconSize } from '@/design-system/tokens/icon';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const CARD_META = {
  lesson: {
    title: 'Урок',
    icon: BookOpen,
    href: () => createPageUrl('Schedule'),
    tone: 'bg-brand text-white',
    accent: 'border-brand/25 from-brand-soft/90 to-card',
  },
  homework: {
    title: 'Домашнее задание',
    icon: ClipboardCheck,
    href: () => createPageUrl('HomeworkList'),
    tone: 'bg-brand-gold text-[hsl(0_12%_10%)]',
    accent: 'border-brand-gold/30 from-brand-gold-soft/90 to-card',
  },
  exam: {
    title: 'Экзамен',
    icon: GraduationCap,
    href: () => createPageUrl('StudentExams'),
    tone: 'bg-[hsl(210_45%_42%)] text-white',
    accent: 'border-[hsl(210_40%_70%/0.4)] from-[hsl(210_40%_96%)] to-card',
  },
  material: {
    title: 'Материал',
    icon: FileText,
    href: () => createPageUrl('MaterialsHub'),
    tone: 'bg-foreground text-background',
    accent: 'border-border from-muted/80 to-card',
  },
};

export default function CrmMessageCard({ message }) {
  const meta = CARD_META[message.type] || CARD_META.material;
  const Icon = meta.icon;
  const href = meta.href();
  return (
    <Link
      to={href}
      className={cn(
        'mt-0.5 flex max-w-xs items-center gap-3 rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm transition-transform duration-150 hover:brightness-[0.99] active:scale-[0.985]',
        meta.accent,
      )}
    >
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shadow-sm', meta.tone)}>
        <Icon className={iconSize.md} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-brand">{meta.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {message.body || message.refEntityType || 'Открыть'}
        </p>
      </div>
    </Link>
  );
}
