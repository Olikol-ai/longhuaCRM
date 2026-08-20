import { useEffect, useState } from 'react';
import { withAccessToken } from '@/lib/auth-media-url';
import LonghuaAudioPlayer from '@/components/media/LonghuaAudioPlayer';

/**
 * Learning / materials / homework audio entry point.
 * Resolves auth-protected URLs, then delegates to LonghuaAudioPlayer (single engine).
 */
export default function AuthenticatedAudio({
  src,
  className,
  preload = 'metadata',
  wrapperClassName,
  variant = 'material',
}) {
  const [resolved, setResolved] = useState(() => withAccessToken(src));

  useEffect(() => {
    setResolved(withAccessToken(src));
  }, [src]);

  return (
    <LonghuaAudioPlayer
      src={resolved || null}
      variant={variant}
      className={className}
      wrapperClassName={wrapperClassName}
      preload={preload}
      emptyLabel="Аудиофайл недоступен."
    />
  );
}
