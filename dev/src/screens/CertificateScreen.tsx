/**
 * CertificateScreen: Public certificate verification page at /cert/:shareToken
 */
import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface CertData {
  id: string;
  type: string;
  title: string;
  metadata: { track?: string; challengesSolved?: number; avgCost?: number } | null;
  shareToken: string;
  earnedAt: string | null;
  holder: { name: string | null; username: string | null; avatarUrl: string | null } | null;
}

export function CertificateScreen() {
  const route = useRoute();
  const params = (route.params || {}) as { shareToken?: string };
  const shareToken = params.shareToken ?? '';
  const c = useColors();

  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) {
      setError('Invalid certificate link');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/cert/${shareToken}`);
        if (!res.ok) {
          setError('Certificate not found');
          setLoading(false);
          return;
        }
        setCert(await res.json());
      } catch {
        setError('Failed to load');
      }
      setLoading(false);
    })();
  }, [shareToken]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (error || !cert) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textMuted, fontSize: 16 }}>{error || 'Not found'}</Text>
      </View>
    );
  }

  const earnedDate = cert.earnedAt ? new Date(cert.earnedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : '';

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.cert, { borderColor: c.accent }]}>
        {/* Header */}
        <Text style={[styles.brand, { color: c.accent }]}>ruwt.dev</Text>
        <Text style={[styles.certLabel, { color: c.textMuted }]}>Certificate of Completion</Text>

        {/* Holder */}
        <Text style={[styles.holderName, { color: c.text }]}>
          {cert.holder?.name || 'Developer'}
        </Text>

        {/* Title */}
        <Text style={[styles.title, { color: c.text }]}>
          {cert.title}
        </Text>

        {/* Details */}
        {cert.metadata && (
          <View style={styles.details}>
            {cert.metadata.challengesSolved && (
              <Text style={[styles.detail, { color: c.textMuted }]}>
                {cert.metadata.challengesSolved} challenges completed
              </Text>
            )}
            {cert.metadata.avgCost != null && (
              <Text style={[styles.detail, { color: c.textMuted }]}>
                Average AI cost: ${(cert.metadata.avgCost / 10000).toFixed(4)}
              </Text>
            )}
          </View>
        )}

        {/* Date */}
        <Text style={[styles.date, { color: c.textMuted }]}>
          Earned {earnedDate}
        </Text>

        {/* Verification */}
        <View style={[styles.verification, { borderTopColor: c.border }]}>
          <Text style={[styles.verifyLabel, { color: c.success }]}>
            Verified
          </Text>
          <Text style={[styles.verifyId, { color: c.textSubtle }]}>
            ID: {cert.id.slice(0, 8)}
          </Text>
        </View>

        {/* LinkedIn button */}
        <button
          style={{
            background: '#0A66C2',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 16,
            width: '100%',
          }}
          onClick={() => {
            const certUrl = window.location.href;
            const linkedinAddUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.title)}&organizationName=${encodeURIComponent('ruwt.dev')}&certUrl=${encodeURIComponent(certUrl)}&certId=${encodeURIComponent(cert.id.slice(0, 8))}`;
            window.open(linkedinAddUrl, '_blank');
          }}
        >
          Add to LinkedIn
        </button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  cert: {
    maxWidth: 500,
    width: '100%',
    alignItems: 'center',
    padding: spacing['2xl'],
    borderWidth: 2,
    borderRadius: 16,
  },
  brand: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  certLabel: {
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  holderName: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  details: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  detail: {
    fontSize: fontSizes.sm,
  },
  date: {
    fontSize: fontSizes.sm,
    marginBottom: spacing.lg,
  },
  verification: {
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    width: '100%',
  },
  verifyLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  verifyId: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
});
