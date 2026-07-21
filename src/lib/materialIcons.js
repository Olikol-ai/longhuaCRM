import { FileText, Video, Link2, File } from 'lucide-react';

export const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40', label: 'PDF' },
  pptx: { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40', label: 'PPTX' },
  video: { icon: Video, color: 'text-brand', bg: 'bg-brand-soft dark:bg-brand-soft/40', label: 'Видео' },
  link: { icon: Link2, color: 'text-brand', bg: 'bg-brand-soft dark:bg-brand-soft/40', label: 'Ссылка' },
  other: { icon: File, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Файл' },
};

export function getMaterialTypeInfo(fileType) {
  return FILE_TYPE_ICONS[fileType] || FILE_TYPE_ICONS.other;
}
