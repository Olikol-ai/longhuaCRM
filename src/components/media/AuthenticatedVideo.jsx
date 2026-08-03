import { useEffect, useState } from 'react';
import { withAccessToken } from '@/lib/auth-media-url';

export default function AuthenticatedVideo({
  src,
  className = 'w-full max-w-full max-h-72 rounded-xl border object-contain',
  preload = 'metadata',
}) {
  const [resolved, setResolved] = useState(() => withAccessToken(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolved(withAccessToken(src));
    setFailed(false);
  }, [src]);

  if (!src || failed || !resolved) {
    return <p className="text-sm text-muted-foreground mt-3">Видеофайл недоступен.</p>;
  }

  return (
    <video
      className={className}
      controls
      preload={preload}
      src={resolved}
      playsInline
      onError={() => setFailed(true)}
    >
      Видеофайл недоступен.
    </video>
  );
}
