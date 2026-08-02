import { Link } from 'react-router-dom';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

const CARDS = [
  {
    title: 'Конструктор заданий',
    text: 'Создавайте вопросы без JSON, с preview «как у ученика».',
    page: 'ExamContentBank',
  },
  {
    title: 'Медиатека',
    text: 'Общие аудио, изображения и PDF для заданий и групп.',
    page: 'ExamContentMedia',
  },
  {
    title: 'Конструктор экзаменов',
    text: 'Section → Block → правила сборки и lifecycle редакций.',
    page: 'ExamContentExams',
  },
  {
    title: 'Импорт / экспорт / bulk',
    text: 'Пакетные операции и выгрузка банка с манифестом media.',
    page: 'ExamContentOps',
  },
];

export default function ExamContentHub() {
  return (
    <ExamContentShell active="hub">
      <p className="text-muted-foreground max-w-2xl">
        Единый источник контента для HSK / HSKK / YCT / BCT и внутренних экзаменов.
        HSK Academy использует только генератор ECP и Assessment runtime.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((card) => (
          <div key={card.page} className="rounded-lg border border-border p-5 space-y-3 bg-card">
            <h2 className="text-lg font-medium">{card.title}</h2>
            <p className="text-sm text-muted-foreground">{card.text}</p>
            <Button asChild variant="outline" size="sm">
              <Link to={createPageUrl(card.page)}>Открыть</Link>
            </Button>
          </div>
        ))}
      </div>
    </ExamContentShell>
  );
}
