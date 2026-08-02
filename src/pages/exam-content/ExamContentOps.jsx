import { useState } from 'react';
import { api } from '@/api';
import ExamContentShell from '@/components/exam-content/ExamContentShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { userFacingError } from '@/lib/userFacingError';

export default function ExamContentOps() {
  const [levelId, setLevelId] = useState('');
  const [jsonText, setJsonText] = useState('[]');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const runImport = async () => {
    setError('');
    try {
      const rows = JSON.parse(jsonText);
      const job = await api.examContent.import({ format: 'json', rows });
      setResult(job);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const runExport = async () => {
    setError('');
    try {
      const data = await api.examContent.export({
        format: 'json',
        level_id: levelId || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const recompute = async () => {
    setError('');
    try {
      const data = await api.examContent.recomputeStats();
      setResult(data);
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <ExamContentShell
      active="ops"
      title="Дополнительно"
      description="Массовые операции для опытных пользователей. Обычное создание вопросов и тестов — в разделах «Банк» и «Тесты»."
    >
      <Card className="p-4 space-y-3 border-border">
        <h2 className="font-medium">Импорт из JSON</h2>
        <p className="text-sm text-muted-foreground">
          Вставьте массив заданий. После импорта они появятся в банке как черновики.
        </p>
        <textarea
          className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        <Button type="button" className="min-h-11" onClick={runImport}>
          Импортировать
        </Button>
      </Card>

      <Card className="p-4 space-y-3 border-border">
        <h2 className="font-medium">Экспорт</h2>
        <label className="text-sm space-y-1 block max-w-md">
          <span className="text-muted-foreground">Уровень (необязательно)</span>
          <Input value={levelId} onChange={(e) => setLevelId(e.target.value)} />
        </label>
        <Button type="button" variant="outline" className="min-h-11" onClick={runExport}>
          Экспортировать JSON
        </Button>
      </Card>

      <Card className="p-4 space-y-3 border-border">
        <h2 className="font-medium">Статистика заданий</h2>
        <p className="text-sm text-muted-foreground">
          Пересчитать показатели сложности по результатам учеников (только для администратора).
        </p>
        <Button type="button" variant="secondary" className="min-h-11" onClick={recompute}>
          Пересчитать
        </Button>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <pre className="rounded-lg border border-border p-4 text-xs overflow-auto bg-muted/40">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </ExamContentShell>
  );
}
