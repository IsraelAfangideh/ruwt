import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/shared/lib/supabase/client';
import { FeaturedReplay } from '@/shared/social/FeaturedReplay';
import { ActivityFeed } from '@/shared/social/ActivityFeed';
import { PlatformStats } from '@/shared/social/PlatformStats';
import { useTheme } from '@/shared/theme';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { DEFAULT_AUTH_REDIRECT } from '@/shared/navigation/types';
import { resetNavigation } from '@/shared/navigation/resetNavigation';
import './landing.css';

/**
 * Scroll-reveal and the count-up both need callbacks the platform may not run:
 * IntersectionObserver may be missing entirely, and a browser suspends both it
 * and rAF while the page is hidden. When we cannot be sure they will fire,
 * everything renders in its final state — content must never be stranded at
 * opacity 0.
 */
function canAnimate() {
  if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') return false;
  if (document.hidden) return false;
  return !(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* One observer for the whole page rather than one per reveal — every caller
   wants the same thresholds, and the page has ~19 of them. */
const revealCallbacks = new WeakMap<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

/* istanbul ignore next -- @preserve */
function observeOnce(el: Element, onEnter: () => void) {
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        sharedObserver?.unobserve(entry.target);
        revealCallbacks.get(entry.target)?.();
        revealCallbacks.delete(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );
  revealCallbacks.set(el, onEnter);
  sharedObserver.observe(el);
  return () => {
    sharedObserver?.unobserve(el);
    revealCallbacks.delete(el);
  };
}

/** Fires once when the element first scrolls into view. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => !canAnimate());

  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!canAnimate() || !ref.current) {
      setInView(true);
      return;
    }
    /* istanbul ignore next -- @preserve */
    return observeOnce(ref.current, () => setInView(true));
  }, []);

  return [ref, inView] as const;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="lp-reveal" data-in={inView} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/**
 * A dollar figure that eases up from zero — the hero's whole argument is a
 * number moving. Its own component so the ~150 frames of the animation
 * re-render one text node, not the entire page.
 */
function Cost({
  target,
  durationMs,
  run,
  className,
}: {
  target: number;
  durationMs: number;
  run: boolean;
  className: string;
}) {
  const [value, setValue] = useState(() => (canAnimate() ? 0 : target));

  useEffect(() => {
    if (!run) return;
    if (!canAnimate()) {
      setValue(target);
      return;
    }
    /* istanbul ignore next -- @preserve */
    let frame = 0;
    /* istanbul ignore next -- @preserve */
    const started = performance.now();
    /* istanbul ignore next -- @preserve */
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / durationMs);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    /* istanbul ignore next -- @preserve */
    frame = requestAnimationFrame(tick);
    /* istanbul ignore next -- @preserve */
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, run]);

  return <p className={className}>${value.toFixed(4)}</p>;
}

/**
 * Frames a live component, and hides itself while that component renders
 * nothing. ActivityFeed and PlatformStats both return null until their fetch
 * lands, and stay null when there is too little data — without this the
 * section shows empty bordered boxes.
 */
function SignalPanel({
  label,
  wide,
  children,
}: {
  label?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    /* istanbul ignore next -- @preserve */
    if (!el || typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => {
      /* istanbul ignore else -- @preserve */
      if (el.childElementCount > 0) {
        setFilled(true);
        mo.disconnect(); // nothing to watch for once content has arrived
      }
    });
    setFilled(el.childElementCount > 0);
    if (el.childElementCount === 0) mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, []);

  return (
    <div className={wide ? 'lp-panel lp-panel--wide' : 'lp-panel'} hidden={!filled}>
      {label ? <span className="lp-mono">{label}</span> : null}
      <div ref={ref}>{children}</div>
    </div>
  );
}

/** `01 — The Arena`, the ruled kicker that opens every section. */
function Kicker({ index, label }: { index: string; label: string }) {
  return (
    <div className="lp-kicker lp-mono">
      <b>{index}</b> <span>{label}</span> <hr />
    </div>
  );
}

/** The numbered ledger list used for both the AFI dimensions and IDE features. */
function Rows({ items }: { items: { name: string; desc: string }[] }) {
  return (
    <div className="lp-rows">
      {items.map((item, i) => (
        <div className="lp-row" key={item.name}>
          <span className="lp-row-idx">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="lp-row-name">{item.name}</h3>
          <p className="lp-row-desc">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

/** A ruled band of figures. Columns divide by item count, so 3 and 4 both fit. */
function StatStrip({
  items,
  className,
  style,
}: {
  items: { value: string; label: string }[];
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <dl className={className ? `lp-strip ${className}` : 'lp-strip'} style={style}>
      {items.map((s) => (
        <div key={s.label}>
          <dt>{s.value}</dt>
          <dd>{s.label}</dd>
        </div>
      ))}
    </dl>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7.5 5.5 11 12 3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ── Page content ─────────────────────────────────────────────────────────── */

const DIMENSIONS = [
  {
    name: 'Model Selection',
    desc: 'Know when a $0.01 model does the job and when you actually need a $0.50 one. Reaching for premium on FizzBuzz is a red flag.',
  },
  {
    name: 'Prompt Efficiency',
    desc: 'Working code in fewer tokens. Concise, structured prompts beat verbose walls of text on every measure that matters.',
  },
  {
    name: 'Iterative Debugging',
    desc: 'Real engineering tickets. Diagnose and fix the actual defect — do not burn tokens asking for a full rewrite.',
  },
  {
    name: 'Multi-Model Strategy',
    desc: 'Switch tiers mid-solve. Micro for boilerplate, reasoning for the part that is genuinely hard. Most people never switch at all.',
  },
  {
    name: 'Speed',
    desc: 'Wall-clock efficiency. Fast and cheap ranks above fast alone. Deliberate speed, not rushed guessing.',
  },
];

const IDE_FEATURES = [
  {
    name: 'AI Agent',
    desc: 'The agent reads your code, writes fixes, runs commands, and iterates on its own. Agent, Plan, Debug, and Ask modes.',
  },
  {
    name: 'npm Packages',
    desc: 'Install any npm package straight in the browser. Packages resolve and install client-side — there is no server.',
  },
  {
    name: 'Full Terminal',
    desc: 'node, npm, npx, git, and the rest of the shell. Tab completion included. Run your code the moment you write it.',
  },
  {
    name: 'Bring Your Own Key',
    desc: 'Use the free open-weight models, or plug in your own Claude, GPT, or Groq key when you want the premium tiers.',
  },
  {
    name: 'Auto-Save',
    desc: 'Projects persist to the cloud. Close the tab, open it on another machine, pick up on the same line.',
  },
];

const TIERS = [
  {
    score: '400+',
    name: 'AI-Fluent',
    req: '10+ challenges',
    desc: 'You can drive AI effectively. A solid foundation in model selection and prompting.',
  },
  {
    score: '550+',
    name: 'AI-Fluent Pro',
    req: '25+ across 3 categories',
    desc: 'A versatile operator. Efficient across several problem domains, not just the one you practise.',
  },
  {
    score: '700+',
    name: 'AI-Fluent Expert',
    req: '50+ across all categories',
    desc: 'Top 5%. Exceptional efficiency on every dimension of AI-assisted engineering.',
  },
];

const HERO_STATS = [
  { value: 'Free', label: 'Browser IDE' },
  { value: '15', label: 'AI models' },
  { value: '$0', label: 'To start' },
  { value: '0–850', label: 'AFI score' },
];

const ARENA_STATS = [
  { value: '100+', label: 'Challenges' },
  { value: '15', label: 'AI models' },
  { value: '5', label: 'Cost tiers' },
  { value: '4', label: 'Categories' },
];

const TEAM_STATS = [
  { value: '0–850', label: 'AFI score' },
  { value: '100+', label: 'Challenges' },
  { value: '3-tier', label: 'Certification' },
];

const TRUST = [
  { name: 'Powered by Cloudflare', desc: 'Enterprise-grade infrastructure, deployed to the edge for low latency worldwide.' },
  { name: 'Open Source Models', desc: 'No vendor lock-in. The default models are open-weight and community-audited.' },
  { name: 'Your Data Stays Private', desc: 'Code runs in sandboxed execution. We never store your solutions beyond the session.' },
  { name: 'Real Leaderboard', desc: 'Rankings come from actual AI spend — no gamification tricks, no vanity metrics.' },
];

export function LandingScreen() {
  useDocumentMeta({ canonicalPath: '/' });
  const navigation = useNavigation();
  const { isDark } = useTheme();

  // Logged-in visitors never see the pitch.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) resetNavigation(navigation, [{ name: DEFAULT_AUTH_REDIRECT }]);
      })
      .catch(() => {
        /* auth check is best-effort */
      });
  }, [navigation]);

  const [ledgerRef, ledgerIn] = useInView<HTMLDivElement>();

  const go = (screen: string) => () => navigation.navigate(screen as never);

  return (
    <ScrollView style={{ flex: 1 }}>
      <a className="skip-link" href="#landing-main">Skip to main content</a>

      <div className="lp" data-theme={isDark ? 'dark' : 'light'}>
        <div className="lp-rules" aria-hidden="true" />
        <div className="lp-grain" aria-hidden="true" />

        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <div className="lp-shell">
          <header className="lp-nav">
            <div className="lp-mark">
              <b>Ruwt</b>
              <span className="lp-mono">/dev</span>
            </div>
            <nav className="lp-nav-links" aria-label="Main navigation">
              <button type="button" className="lp-btn lp-btn--ghost" onClick={go('Hiring')}>
                For Teams
              </button>
              <button type="button" className="lp-btn lp-btn--ghost" onClick={go('Login')}>
                Sign in
              </button>
              <button type="button" className="lp-btn lp-btn--gold lp-btn--sm" onClick={go('Register')}>
                Get Started
              </button>
            </nav>
          </header>
        </div>

        <main id="landing-main" tabIndex={-1}>
          {/* ── Hero ───────────────────────────────────────────────────── */}
          <div className="lp-shell">
            <section className="lp-hero">
              <p className="lp-eyebrow lp-mono lp-rise" style={{ animationDelay: '80ms' }}>
                <i aria-hidden="true" />
                <em>Now in Beta</em>
                <span aria-hidden="true">—</span>
                <span>Free browser IDE</span>
              </p>

              <h1 className="lp-display lp-rise" style={{ animationDelay: '160ms' }}>
                What&rsquo;s your
                <br />
                AI <em>Fluency</em> Index?
              </h1>

              <span className="lp-draw" aria-hidden="true" />

              <p className="lp-deck lp-rise" style={{ animationDelay: '280ms' }}>
                A browser IDE with 15 AI models built in. Solve real engineering challenges, then
                get scored on the thing no other tool measures: what it cost you to get there.
              </p>

              {/* The argument, in two columns. */}
              <div ref={ledgerRef} className="lp-ledger lp-rise" style={{ animationDelay: '400ms' }}>
                <div className="lp-ledger-head lp-mono">
                  <span>Ledger &mdash; one challenge, two solve paths</span>
                  <span>Both pass every test</span>
                </div>

                <div className="lp-ledger-body">
                  <div className="lp-col">
                    <p className="lp-col-tag lp-mono">No strategy</p>
                    <Cost target={0.412} durationMs={2600} run={ledgerIn} className="lp-cost" />
                    <ul className="lp-meta">
                      <li><span>Models</span><b>Premium &times; 11</b></li>
                      <li><span>Prompts</span><b>11</b></li>
                      <li><span>Tokens</span><b>48,210</b></li>
                    </ul>
                    <p className="lp-pass lp-mono"><Check /> Passed</p>
                  </div>

                  <div className="lp-col lp-col--win">
                    <p className="lp-col-tag lp-mono">AFI 780</p>
                    <Cost target={0.0031} durationMs={900} run={ledgerIn} className="lp-cost" />
                    <ul className="lp-meta">
                      <li><span>Models</span><b>Micro &rarr; Mid</b></li>
                      <li><span>Prompts</span><b>2</b></li>
                      <li><span>Tokens</span><b>1,940</b></li>
                    </ul>
                    <p className="lp-pass lp-mono"><Check /> Passed</p>
                  </div>
                </div>

                <div className="lp-ledger-foot">
                  <strong>133&times; the spend for the same green tests.</strong>
                  <span className="lp-mono">Illustrative figures, real model pricing</span>
                </div>
              </div>

              <div className="lp-ctas lp-hero-ctas lp-rise" style={{ animationDelay: '520ms' }}>
                <button type="button" className="lp-btn lp-btn--gold" onClick={go('Register')}>
                  Find Your Score
                </button>
                <button type="button" className="lp-btn lp-btn--line" onClick={go('IDE')}>
                  Open the IDE — Free
                </button>
              </div>

              <StatStrip items={HERO_STATS} className="lp-rise" style={{ animationDelay: '620ms' }} />
            </section>
          </div>

          {/* ── Ticker ─────────────────────────────────────────────────── */}
          <div className="lp-ticker" aria-hidden="true">
            {/* Duplicated once so translateX(-50%) loops seamlessly. */}
            <ul className="lp-mono">
              {[0, 1].map((pass) =>
                DIMENSIONS.map((d) => <li key={`${pass}-${d.name}`}>{d.name}</li>),
              )}
            </ul>
          </div>

          {/* ── 01 · The Arena ─────────────────────────────────────────── */}
          <div className="lp-shell">
            <section className="lp-sec" style={{ borderTop: 0 }}>
              <Reveal>
                <Kicker index="01" label="The Arena" />
                <div className="lp-sec-head">
                  <h2 className="lp-display">Every solve is an itemized receipt.</h2>
                  <p className="lp-deck">
                    Pick from 100+ engineering challenges — race conditions, off-by-ones, flaky
                    tests, the tickets you actually get assigned. Solve them with AI in the Arena
                    IDE. Every prompt, every token, every cent is on the record.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="lp-frame">
                  <div className="lp-frame-bar lp-mono">
                    <i aria-hidden="true" />
                    <i aria-hidden="true" />
                    <i aria-hidden="true" />
                    <span>arena — connection-pool-race.ts</span>
                  </div>
                  <img
                    src="/arena-preview.png"
                    alt="The Arena IDE, showing the code editor, AI chat panel, and terminal side by side"
                    loading="lazy"
                    width={1600}
                    height={1000}
                  />
                </div>
              </Reveal>

              <Reveal delay={80}>
                <StatStrip items={ARENA_STATS} />
              </Reveal>

              <Reveal delay={120}>
                <div className="lp-ticket">
                  <div className="lp-ticket-top lp-mono">
                    <span className="lp-tag">Real-world</span>
                    <span>RUWT-412 · Debugging · Hard</span>
                  </div>
                  <h3>Fix the Connection Pool Race Condition</h3>
                  <p className="lp-deck">
                    A Jira-style engineering ticket with a genuine race condition underneath. You
                    can find it. The question is whether you can find it cheaply.
                  </p>
                  <div className="lp-ticket-actions">
                    <button type="button" className="lp-btn lp-btn--gold lp-btn--sm" onClick={go('Register')}>
                      Try This Challenge
                    </button>
                    <button type="button" className="lp-btn lp-btn--line lp-btn--sm" onClick={go('Problems')}>
                      Browse Challenges
                    </button>
                  </div>
                </div>
              </Reveal>
            </section>

            {/* ── 02 · The Index ───────────────────────────────────────── */}
            <section className="lp-sec">
              <Reveal>
                <Kicker index="02" label="The Index" />
                <div className="lp-sec-head">
                  <h2 className="lp-display">One number for how well you use AI.</h2>
                  <p className="lp-deck">
                    Your AI Fluency Index runs 0 to 850. Cheap, fast, correct solves push it up.
                    Wasteful prompting pulls it down. Hit a milestone and the certification is
                    yours to put on a profile.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <div className="lp-gauge">
                  <svg viewBox="0 0 1000 100" role="img" aria-label="The AI Fluency Index runs from 0 to 850. Certification tiers begin at 400 for AI-Fluent, 550 for Pro, and 700 for Expert.">
                    <g className="lp-gauge-fill">
                      <rect x="470" y="46" width="176" height="9" opacity="0.32" />
                      <rect x="648" y="46" width="174" height="9" opacity="0.62" />
                      <rect x="824" y="46" width="176" height="9" />
                    </g>
                    <line className="lp-gauge-rule" x1="0" y1="62" x2="1000" y2="62" />
                    {[
                      { x: 0, label: '0' },
                      { x: 470, label: '400' },
                      { x: 647, label: '550' },
                      { x: 823, label: '700' },
                      { x: 999, label: '850' },
                    ].map((t) => (
                      <g key={t.label}>
                        <line className="lp-gauge-tick" x1={t.x} y1="62" x2={t.x} y2="72" />
                        <text className="lp-gauge-label" x={t.x} y="88" textAnchor={t.x > 900 ? 'end' : t.x < 40 ? 'start' : 'middle'}>
                          {t.label}
                        </text>
                      </g>
                    ))}
                    {[
                      { x: 558, label: 'AI-FLUENT' },
                      { x: 735, label: 'PRO' },
                      { x: 912, label: 'EXPERT' },
                    ].map((z) => (
                      <text key={z.label} className="lp-gauge-tier" x={z.x} y="32" textAnchor="middle">
                        {z.label}
                      </text>
                    ))}
                  </svg>
                </div>
              </Reveal>

              <Reveal>
                <Rows items={DIMENSIONS} />
              </Reveal>

              <Reveal>
                <div className="lp-tiers">
                  {TIERS.map((t) => (
                    <div className="lp-tier" key={t.name}>
                      <p className="lp-tier-score">{t.score}</p>
                      <h3>{t.name}</h3>
                      <p>{t.desc}</p>
                      <p className="lp-tier-req lp-mono">{t.req}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </section>

            {/* ── 03 · The IDE ─────────────────────────────────────────── */}
            <section className="lp-sec">
              <Reveal>
                <Kicker index="03" label="The IDE" />
                <div className="lp-sec-head">
                  <h2 className="lp-display">A full dev environment. Nothing to install.</h2>
                  <p className="lp-deck">
                    Monaco editor, an AI agent that reads and writes your files, npm, a real
                    terminal, git. Running on open-weight models at zero cost. Open a tab and
                    build something.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <Rows items={IDE_FEATURES} />
              </Reveal>

              <Reveal>
                <div className="lp-ctas" style={{ marginTop: 40 }}>
                  <button type="button" className="lp-btn lp-btn--gold" onClick={go('IDE')}>
                    Open the IDE
                  </button>
                  <button type="button" className="lp-btn lp-btn--line" onClick={go('Register')}>
                    See Today&rsquo;s Challenge
                  </button>
                </div>
              </Reveal>
            </section>

            {/* ── 04 · In the open ─────────────────────────────────────── */}
            <section className="lp-sec">
              <Reveal>
                <Kicker index="04" label="In the open" />
                <div className="lp-sec-head">
                  <h2 className="lp-display">Built on Trust</h2>
                  <p className="lp-deck">
                    Every replay is public. Every cost is real. Watch how the cheapest solvers
                    actually think, then go beat them.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <div className="lp-signals">
                  <SignalPanel label="Platform to date" wide>
                    <PlatformStats />
                  </SignalPanel>
                  <SignalPanel>
                    <ActivityFeed limit={5} heading="Developers are solving challenges right now" />
                  </SignalPanel>
                  {/* FeaturedReplay always renders — it falls back to sample copy
                      — so it needs no empty-state watching. */}
                  <div className="lp-panel">
                    <FeaturedReplay />
                  </div>
                </div>
              </Reveal>

              <Reveal>
                <div className="lp-trust">
                  {TRUST.map((t) => (
                    <div key={t.name}>
                      <h3>{t.name}</h3>
                      <p>{t.desc}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </section>
          </div>

          {/* ── Teams — the contrast flip ──────────────────────────────── */}
          <section className="lp-invert">
            <div className="lp-shell">
              <Reveal>
                <Kicker index="05" label="For Teams" />
                <div className="lp-sec-head">
                  <h2 className="lp-display">
                    Measure your team&rsquo;s <em>AI Fluency</em>.
                  </h2>
                  <p className="lp-deck">
                    Benchmark the engineers you have. Assess the ones you are hiring. Everybody
                    gets an AFI — objective, comparable, backed by real usage data. You find out
                    who is efficient and who needs upskilling.
                  </p>
                </div>
              </Reveal>

              <Reveal>
                <StatStrip items={TEAM_STATS} />
              </Reveal>

              <Reveal>
                <div className="lp-ctas" style={{ marginTop: 40 }}>
                  <button type="button" className="lp-btn lp-btn--gold" onClick={go('Hiring')}>
                    Benchmark Your Team
                  </button>
                  <button type="button" className="lp-btn lp-btn--line" onClick={go('Hiring')}>
                    Assess Candidates
                  </button>
                </div>
              </Reveal>
            </div>
          </section>

          {/* ── Closing ────────────────────────────────────────────────── */}
          <div className="lp-shell">
            <section className="lp-close">
              <Reveal>
                <h2 className="lp-display">
                  What will your <em>AFI</em> be?
                </h2>
                <p className="lp-deck">
                  100+ challenges. 15 AI models. One number that says how well you use them.
                  Free to start.
                </p>
                <div className="lp-ctas">
                  <button type="button" className="lp-btn lp-btn--gold" onClick={go('Register')}>
                    Find Your Score
                  </button>
                  <button type="button" className="lp-btn lp-btn--line" onClick={go('Hiring')}>
                    Benchmark Your Team
                  </button>
                </div>
              </Reveal>
            </section>
          </div>
        </main>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="lp-shell">
          <footer className="lp-foot lp-mono">
            <span>© {new Date().getFullYear()} Ruwt — All rights reserved</span>
            <span>ruwt.dev</span>
          </footer>
        </div>
      </div>
    </ScrollView>
  );
}
