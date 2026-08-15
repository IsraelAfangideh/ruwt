import { useEffect, useState } from 'react';
import {
  detectPlatform,
  trackDownload,
  triggerFileDownload,
  type DownloadSource,
} from '@/lib/marketing/tracking';

export const MAC_INSTALL = 'curl -fsSL https://ruwt.ai/install.sh | bash';

type Props = {
  source: DownloadSource;
  compact?: boolean;
};

export function DownloadButton({ source, compact = false }: Props) {
  const [label, setLabel] = useState('Download');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [hint, setHint] = useState('');
  const [command, setCommand] = useState('');

  useEffect(() => {
    if (compact) {
      setLabel('Download');
      return;
    }
    const platform = detectPlatform();
    if (platform === 'macos') setLabel('Install on this Mac');
    else if (platform === 'windows') setLabel('Download for Windows');
    else if (platform === 'linux') setLabel('Download for Linux');
  }, [compact]);

  const onClick = async () => {
    if (state !== 'idle') return;
    setState('busy');
    const artifact = await trackDownload(source);
    const platform = detectPlatform();
    window.setTimeout(() => {
      if (platform === 'macos') {
        const copied = navigator.clipboard?.writeText(MAC_INSTALL);
        if (copied) void copied.catch(() => undefined);
        setCommand(MAC_INSTALL);
        setHint('Paste in Terminal. The app opens.');
        setState('done');
        if (compact) {
          setLabel('Copied');
          window.setTimeout(() => {
            setState('idle');
            setLabel('Download');
          }, 2500);
        }
        return;
      }
      triggerFileDownload(artifact);
      setState('done');
      if (platform === 'windows') {
        setHint('Open Ruwt-Setup.exe. The app launches when setup finishes.');
      } else {
        setHint('Open the file in Downloads. That is the whole install.');
      }
    }, 900);
  };

  const button = (
    <button type="button" className={compact ? 'dl dl--sm' : 'dl'} data-state={state} onClick={() => void onClick()} aria-label={label}>
      <span className="dl-label">{state === 'done' && compact ? 'Copied' : label}</span>
      <svg className="dl-orb" viewBox="0 0 22 22" aria-hidden="true">
        <circle className="track" cx="11" cy="11" r="8" />
        <circle className="spin" cx="11" cy="11" r="8" />
        <path className="dl-check" d="M6.5 11.2l3 3 6-6.4" />
      </svg>
    </button>
  );

  if (compact) return button;

  return (
    <div className="mk-cta-row">
      {button}
      <p className="mk-hint" data-visible={hint ? 'true' : 'false'}>
        {hint}
      </p>
      {command ? (
        <div className="mk-install-wrap">
          <button
            type="button"
            className="mk-install"
            onClick={() => {
              const copied = navigator.clipboard?.writeText(command);
              if (copied) void copied.catch(() => undefined);
            }}
          >
            {command}
          </button>
          <button
            type="button"
            className="mk-link"
            onClick={() => triggerFileDownload({ url: '/downloads/Ruwt.dmg', filename: 'Ruwt.dmg' })}
          >
            Disk image instead
          </button>
        </div>
      ) : null}
    </div>
  );
}
