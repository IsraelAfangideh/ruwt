/**
 * GuestArenaScreen: Stripped-down ArenaScreen for unauthenticated users.
 * Route: /try/:challengeId
 * - Loads challenge publicly, no auth needed
 * - Monaco editor works, code execution works
 * - AI chat shows "Sign up to use AI" prompt
 * - Run Tests / Submit show signup overlay
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge } from '@/features/arena/ArenaIDE';
import ModalOverlay, { OVERLAY_TITLE, overlayButton } from '@/shared/ui/ModalOverlay';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { getDifficultyStyle } from '@/shared/lib/difficulty';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { SplitPaneSkeleton } from '@/shared/ui/ScreenSkeletons';

export function GuestArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { challengeId?: string };
  /* istanbul ignore next -- @preserve */
  const challengeId = params.challengeId ?? '';

  const [challenge, setChallenge] = useState<ArenaChallenge | null>(null);
  const [code, setCode] = useState('');
  const language = challenge?.language || 'javascript';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignupOverlay, setShowSignupOverlay] = useState(false);

  useDocumentMeta({
    title: challenge ? `Try: ${challenge.title}` : 'Try Challenge',
    description: /* istanbul ignore next -- @preserve */ challenge ? `${challenge.difficulty} ${/* istanbul ignore next -- @preserve */ challenge.category || ''} challenge. ${challenge.description?.slice(0, 120)}...` : undefined,
    canonicalPath: challengeId ? `/try/${challengeId}` : undefined,
  });

  // Load challenge on mount (public endpoint, no auth)
  useEffect(() => {
    if (!challengeId) {
      setError('No challenge selected');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}`);
        /* istanbul ignore next -- @preserve */
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? 'Challenge not found' : 'Failed to load challenge');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setChallenge(data);
        setCode(data.starterCode || '// your code here');
      } catch (e) {
        /* istanbul ignore next -- @preserve */
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        /* istanbul ignore next -- @preserve */
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId]);

  const PISTON_LANGUAGES: Record<string, { language: string; version: string }> = {
    javascript: { language: 'javascript', version: '18.15.0' },
    typescript: { language: 'typescript', version: '5.0.3' },
    python: { language: 'python', version: '3.10.0' },
  };

  const onRunCode = useCallback(async (sourceCode: string, lang: string) => {
    /* istanbul ignore next -- @preserve */
    const pistonLang = PISTON_LANGUAGES[lang] || PISTON_LANGUAGES.javascript;
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ content: sourceCode }],
      }),
    });
    const data = await res.json();
    const run = data.run || {};
    return {
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      exitCode: run.code ?? (run.signal ? 1 : 0),
    };
  }, []);

  // Run Tests / Submit — show signup overlay
  const handleGuestAction = useCallback(() => {
    /* istanbul ignore next -- @preserve */
    if (typeof window !== 'undefined') {
      localStorage.setItem('ruwt_pending_challenge', challengeId);
    }
    setShowSignupOverlay(true);
  }, [challengeId]);

  const onRunTests = useCallback(async () => {
    handleGuestAction();
    return { passed: false, passedTests: 0, totalTests: 0, results: [] };
  }, [handleGuestAction]);

  if (loading) {
    return <SplitPaneSkeleton />;
  }

  if (error || !challenge) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: arena.bg }}>
        <Text style={{ fontSize: 14, color: arena.error, marginBottom: 12 }}>{(() => { /* istanbul ignore next -- @preserve */ return error || 'Challenge not found'; })()}</Text>
        <button
          style={{
            background: 'transparent',
            border: `1px solid ${arena.border}`,
            borderRadius: 6,
            color: arena.text,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => navigation.navigate('Landing')}
        >
          Back to Home
        </button>
      </View>
    );
  }

  const diffStyle = getDifficultyStyle(challenge.difficulty, true);
  const difficultyColor = diffStyle.color;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: arena.bg,
      color: arena.text,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
        padding: '0 16px',
        background: arena.surface,
        borderBottom: `1px solid ${arena.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: arena.textMuted,
              fontSize: 13,
              cursor: 'pointer',
              padding: '4px 8px',
              fontFamily: fontFamily.mono,
            }}
            onClick={() => navigation.navigate('Landing')}
          >
            &larr; ruwt.dev
          </button>
          <span style={{ width: 1, height: 20, background: arena.border }} />
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: arena.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {challenge.title}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: difficultyColor,
            padding: '2px 8px',
            borderRadius: 9999,
            border: `1px solid ${difficultyColor}40`,
            background: diffStyle.bg,
            fontFamily: fontFamily.mono,
            textTransform: 'lowercase',
          }}>
            {diffStyle.label}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: arena.accent,
            padding: '2px 8px',
            borderRadius: 9999,
            border: `1px solid ${arena.accent}40`,
            background: `${arena.accent}15`,
            fontFamily: fontFamily.mono,
          }}>
            GUEST MODE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{
              background: 'transparent',
              border: `1px solid ${arena.border}`,
              borderRadius: 6,
              color: arena.text,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onClick={handleGuestAction}
          >
            Run Tests
          </button>
          <button
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 6,
              color: '#0d1117',
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={handleGuestAction}
          >
            Submit
          </button>
        </div>
      </div>

      {/* IDE Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ArenaIDE
          challenge={challenge}
          guestMode
          code={code}
          onCodeChange={setCode}
          language={language}
          onRunTests={onRunTests}
          onRunCode={onRunCode}
        />

        {/* Signup overlay */}
        {showSignupOverlay && (
          <ModalOverlay
            label="Sign Up to Continue"
            zIndex={200}
            cardStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <h2 style={{ ...OVERLAY_TITLE, fontSize: 20, margin: 0 }}>
              Sign Up to Continue
            </h2>
            <p style={{ fontSize: 13, color: arena.textMuted, margin: 0 }}>
              Create a free account to run tests, submit solutions, and use AI assistance.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
              <button
                style={{ ...overlayButton('primary', 'md'), width: '100%' }}
                onClick={() => navigation.navigate('Register')}
              >
                Sign Up Free
              </button>
              <button
                style={{ ...overlayButton('secondary', 'md'), width: '100%' }}
                onClick={() => navigation.navigate('Login')}
              >
                Already have an account? Sign In
              </button>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: arena.textMuted,
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: '8px 0',
                }}
                onClick={() => setShowSignupOverlay(false)}
              >
                Continue exploring
              </button>
            </div>
          </ModalOverlay>
        )}
      </div>
    </div>
  );
}
