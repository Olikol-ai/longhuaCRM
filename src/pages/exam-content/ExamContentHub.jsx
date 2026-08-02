import { Link } from 'react-router-dom';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

const CARDS = [
  {
    title: 'Банк вопросов',
    text: 'Создавайте и редактируйте задания. Можно сразу посмотреть, как их увидит ученик.',
    page: 'ExamContentBank',
  },
  {
    title: 'Медиатека',
    text: 'Аудио и изображения для заданий. Один файл можно использовать в нескольких вопросах.',
    page: 'ExamContentMedia',
  },
  {
    title: 'Тесты',
    text: 'Пошаговое создание теста: разделы, время в минутах, автоподбор или ручной выбор вопросов.',
    page: 'ExamContentExams',
  },
  {
    title: 'Дополнительно',
    text: 'Массовый импорт и экспорт в JSON для опытных пользователей.',
    page: 'ExamContentOps',
  },
];

export default function ExamContentHub() {
  return (
    <ExamContentShell active="hub">
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.page} to={createPageUrl(card.page)} className="block group min-w-0">
            <Card className="h-full p-4 border-border transition-colors group-hover:bg-muted/40 group-hover:border-brand/30">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-foreground">{card.title}</h2>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-snug">{card.text}</p>
              <Button asChild variant="outline" size="sm" className="mt-4 min-h-10">
                <span>Открыть</span>
              </Button>
            </Card>
          </Link>
        ))}
      </div>
    </ExamContentShell>
  );
}
