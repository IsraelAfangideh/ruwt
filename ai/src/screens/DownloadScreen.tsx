import { MarketingChrome } from '@/marketing/MarketingChrome';
import { DownloadButton } from '@/marketing/DownloadButton';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { detectPlatform } from '@/lib/marketing/tracking';

export function DownloadScreen() {
  const platform = detectPlatform();
  useVisitorTracking('/download');

  return (
    <MarketingChrome active="download" showDownload={false}>
      <main className="mk-shell mk-article">
        <p className="mk-kicker">Desktop launcher</p>
        <h1 className="mk-display" style={{ fontSize: 'clamp(36px, 6vw, 56px)' }}>
          Download Ruwt.
          <br />
          Then stop using this website.
        </h1>
        <p className="mk-deck">
          Detected {platform === 'unknown' ? 'your system' : platform}. On a Mac, paste one line in
          Terminal — the app opens. Windows and Linux still download a file.
        </p>
        <DownloadButton source="download-page" />
        <p className="mk-deck" style={{ marginTop: 28 }}>
          macOS: <code>curl -fsSL https://ruwt.ai/install.sh | bash</code>. Windows: Ruwt-Setup.exe. Linux: ruwt-linux-amd64.
        </p>
      </main>
    </MarketingChrome>
  );
}
