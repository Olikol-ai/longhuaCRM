import { FileText, Video, Link2, File, Music, Image as ImageIcon, Archive } from 'lucide-react';
import { resolveMaterialTypeKey } from '@/lib/materialMeta';

export const FILE_TYPE_ICONS = {
  pdf: { icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40', label: 'PDF' },
  pptx: { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40', label: 'PPTX' },
  video: { icon: Video, color: 'text-brand', bg: 'bg-brand-soft dark:bg-brand-soft/40', label: 'Видео' },
  audio: { icon: Music, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', label: 'Аудио' },
  link: { icon: Link2, color: 'text-brand', bg: 'bg-brand-soft dark:bg-brand-soft/40', label: 'Ссылка' },
  canva: { icon: Link2, color: 'text-brand', bg: 'bg-brand-soft dark:bg-brand-soft/40', label: 'Canva' },
  image: { icon: ImageIcon, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40', label: 'Изображение' },
  archive: { icon: Archive, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/40', label: 'Архив' },
  other: { icon: File, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Файл' },
};

export function getMaterialTypeInfo(fileTypeOrMaterial) {
  const key =
    fileTypeOrMaterial && typeof fileTypeOrMaterial === 'object'
      ? resolveMaterialTypeKey(fileTypeOrMaterial)
      : fileTypeOrMaterial;
  return FILE_TYPE_ICONS[key] || FILE_TYPE_ICONS.other;
}
