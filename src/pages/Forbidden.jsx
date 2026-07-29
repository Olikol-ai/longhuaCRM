import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { resolveRedirect } from '@/lib/routing';

/**
 * Shown when an authenticated user opens a URL their role cannot access.
 * Menu hiding is not security — this is the SPA-level denial UX.
 */
export default function ForbiddenPage({
  title = 'Недостаточно прав',
  description = 'У вашей роли нет доступа к этой странице. Если доступ нужен, обратитесь к администратору.',
  homePath,
}) {
  const { user } = useAuth();
  const home = homePath || resolveRedirect(user);

  return (
    <div className="min-h-app flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
          <ShieldOff className="h-7 w-7 text-rose-600 dark:text-rose-300" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
          403
        </p>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to={home}>На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
