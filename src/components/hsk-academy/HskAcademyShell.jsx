import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import './hsk-academy.css';

export default function HskAcademyShell({ active, children, fullBleed = false }) {
  const { user } = useAuth();
  const canBank = ['admin', 'teacher', 'tutor'].includes(user?.role);
  const tabs = [
    { id: 'hub', label: 'Обзор', page: 'HskAcademy' },
    { id: 'practice', label: 'Тренировка', page: 'HskAcademyPractice' },
    { id: 'mock', label: 'Пробный экзамен', page: 'HskAcademyMock' },
    { id: 'prep', label: 'Моя подготовка', page: 'HskAcademyPreparation' },
    ...(canBank ? [{ id: 'bank', label: 'Банк', page: 'HskAcademyBank' }] : []),
  ];

  return (
    <div className={`hsk-academy ${fullBleed ? 'hsk-academy--bleed' : ''}`}>
      <header className="hsk-topbar">
        <div className="hsk-brand">
          <span className="hsk-brand-mark">华</span>
          <div>
            <strong>HSK Academy</strong>
            <small>Exam Prep Platform</small>
          </div>
        </div>
        <nav className="hsk-tabs" aria-label="HSK Academy">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={createPageUrl(tab.page)}
              className={active === tab.id ? 'is-active' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="hsk-main">{children}</main>
    </div>
  );
}
