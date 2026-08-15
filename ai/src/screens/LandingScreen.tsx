/**
 * ruwt.ai marketing home — one scroll, download-first.
 */
import { useNavigation } from '@react-navigation/native';
import { MarketingChrome } from '@/marketing/MarketingChrome';
import { DownloadButton } from '@/marketing/DownloadButton';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';

export function LandingScreen() {
  const navigation = useNavigation<any>();
  useVisitorTracking('/');

  return (
    <MarketingChrome active="home" showDownload>
      <main>
        <div className="mk-shell">
          <section className="mk-hero">
            <p className="mk-kicker">Agent observation · local first</p>
            <h1 className="mk-display">
              Your agents are already working.
              <br />
              You still can&rsquo;t <em>see</em> the work.
            </h1>
            <p className="mk-deck">
              Ruwt is a small app you download. It sits on your machine, watches Cursor, Claude
              Code, and Codex, and shows you cost, skipped tests, and sensitive access — evidence,
              not vibes. No account. No prompt storage. Nothing leaves until you say so.
            </p>
            <DownloadButton source="landing" />
          </section>
        </div>

        <div className="mk-shell">
          <div className="mk-proof">
            <div>
              <b>0</b>
              <span>Raw prompts stored</span>
            </div>
            <div>
              <b>18</b>
              <span>Event types, redacted</span>
            </div>
            <div>
              <b>1</b>
              <span>Click to get the app</span>
            </div>
          </div>

          <section className="mk-steps" aria-label="How it works">
            <article className="mk-step">
              <i>01</i>
              <h2>Download</h2>
              <p>One click. A disk image lands in Downloads — the same motion as Linear or any app you already trust.</p>
            </article>
            <article className="mk-step">
              <i>02</i>
              <h2>Open it</h2>
              <p>Open the disk image. Drag Ruwt onto Applications, then launch it. Everything else happens in that window.</p>
            </article>
            <article className="mk-step">
              <i>03</i>
              <h2>Keep working</h2>
              <p>Your agents keep shipping. Ruwt records what they did. A workspace is optional, and only when you want to share.</p>
            </article>
          </section>

          <footer className="mk-foot">
            <span>ruwt.ai · the app is the product. This page is the door.</span>
            <button type="button" onClick={() => navigation.navigate('Login')}>
              Already have a workspace? Sign in
            </button>
          </footer>
        </div>
      </main>
    </MarketingChrome>
  );
}
