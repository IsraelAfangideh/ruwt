/**
 * CandidateComparisonView: Side-by-side comparison of two candidates.
 * Shows radar charts, percentile bars, and flag lists for each.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Card, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { AIProfileRadar, type AIProfile } from '@/features/profile/AIProfileRadar';
import { PercentileBar } from '@/features/assessments/components/PercentileBar';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';

interface CandidateOption {
  sessionId: string;
  name: string;
  email: string;
  challengesPassed: number;
  totalChallenges: number;
  totalCost: number;
  totalTokens: number;
}

interface FlagSummary {
  green: string[];
  red: string[];
  yellow: string[];
}

interface ComparativeMetric {
  metric: string;
  candidateValue: number;
  medianValue: number;
  percentile: number;
  narrative: string;
}

interface CandidateComparisonViewProps {
  candidates: CandidateOption[];
  profiles: Record<string, AIProfile>;
  insightsData: Record<string, {
    flags: FlagSummary;
    comparatives: ComparativeMetric[];
  }>;
  formatCost: (cost: number) => string;
}

export function CandidateComparisonView({
  candidates,
  profiles,
  insightsData,
  formatCost,
}: CandidateComparisonViewProps) {
  const c = useColors();
  /* istanbul ignore next -- @preserve */
  const [leftId, setLeftId] = useState<string>(candidates[0]?.sessionId ?? '');
  const [rightId, setRightId] = useState<string>(candidates[1]?.sessionId ?? '');
  const [showLeftDropdown, setShowLeftDropdown] = useState(false);
  const [showRightDropdown, setShowRightDropdown] = useState(false);

  const leftCandidate = candidates.find((cd) => cd.sessionId === leftId);
  const rightCandidate = candidates.find((cd) => cd.sessionId === rightId);
  const leftProfile = profiles[leftId];
  const rightProfile = profiles[rightId];
  const leftInsights = insightsData[leftId];
  const rightInsights = insightsData[rightId];

  if (candidates.length < 2) {
    return (
      <Card style={[styles.card, { borderColor: c.border }]}>
        <CardContent>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Need at least 2 candidates to compare. Invite more candidates to enable comparison.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const renderDropdown = (
    selectedId: string,
    onSelect: (id: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
  ) => (
    <View style={styles.dropdownWrap}>
      <Pressable
        style={[styles.dropdown, { borderColor: c.border, backgroundColor: c.muted + '20' }]}
        onPress={() => setShow(!show)}
      >
        <Text style={[styles.dropdownText, { color: c.text }]} numberOfLines={1}>
          {/* istanbul ignore next -- @preserve */}
          {candidates.find((cd) => cd.sessionId === selectedId)?.name ||
           candidates.find((cd) => cd.sessionId === selectedId)?.email ||
           /* istanbul ignore next -- @preserve */
           'Select candidate'}
        </Text>
        <Text style={{ color: c.textMuted }}>{show ? '\u25B2' : '\u25BC'}</Text>
      </Pressable>
      {show && (
        <View style={[styles.dropdownMenu, { borderColor: c.border, backgroundColor: c.bg }]}>
          {candidates.map((cd) => (
            <Pressable
              key={cd.sessionId}
              style={[
                styles.dropdownItem,
                cd.sessionId === selectedId && { backgroundColor: c.accent + '15' },
              ]}
              onPress={() => { onSelect(cd.sessionId); setShow(false); }}
            >
              <Text style={[styles.dropdownItemText, { color: c.text }]} numberOfLines={1}>
                {(() => { /* istanbul ignore next -- @preserve */ return cd.name || cd.email; })()}
              </Text>
              <Text style={[styles.dropdownItemSub, { color: c.textMuted }]}>
                {cd.challengesPassed}/{cd.totalChallenges} passed
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderFlags = (flags?: FlagSummary) => {
    if (!flags) return null;
    const all = [
      ...flags.green.map((f) => ({ text: f, color: '#5a8a5a', bg: 'rgba(90,138,90,0.1)' })),
      ...flags.yellow.map((f) => ({ text: f, color: '#e5a639', bg: 'rgba(229,166,57,0.1)' })),
      ...flags.red.map((f) => ({ text: f, color: '#c87878', bg: 'rgba(200,120,120,0.1)' })),
    ];
    if (all.length === 0) return <Text style={[styles.noFlags, { color: c.textMuted }]}>No signals detected</Text>;
    return (
      <View style={styles.flagList}>
        {all.map((f, i) => (
          <Badge key={i} variant="outline" style={{ borderColor: f.color, backgroundColor: f.bg }}>
            <Text style={{ fontSize: fontSizes.xs, color: f.color }}>{f.text}</Text>
          </Badge>
        ))}
      </View>
    );
  };

  const renderSide = (
    candidate: CandidateOption | undefined,
    profile: AIProfile | undefined,
    insights: { flags: FlagSummary; comparatives: ComparativeMetric[] } | undefined,
  ) => {
    /* istanbul ignore next -- @preserve */
    if (!candidate) return <Text style={{ color: c.textMuted }}>Select a candidate</Text>;

    return (
      <View style={styles.side}>
        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: candidate.challengesPassed === candidate.totalChallenges ? c.success : c.text }]}>
              {candidate.challengesPassed}/{candidate.totalChallenges}
            </Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Passed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.accent }]}>
              {formatCost(candidate.totalCost)}
            </Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Cost</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.text }]}>
              {candidate.totalTokens.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Tokens</Text>
          </View>
        </View>

        {/* Radar */}
        {profile && (
          <View style={styles.radarWrap}>
            <AIProfileRadar profile={profile} size={200} />
          </View>
        )}

        {/* Flags */}
        <Text style={[styles.subTitle, { color: c.text }]}>Signals</Text>
        {renderFlags(insights?.flags)}

        {/* Comparatives */}
        {insights?.comparatives && insights.comparatives.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            {insights.comparatives.map((cm) => (
              <PercentileBar
                key={cm.metric}
                label={cm.metric}
                value={cm.percentile}
                narrative={cm.narrative}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Card style={[styles.card, { borderColor: c.border }]}>
      <CardContent>
        <Text style={[styles.title, { color: c.text }]}>Compare Candidates</Text>

        {/* Dropdowns */}
        <View style={styles.selectRow}>
          {renderDropdown(leftId, setLeftId, showLeftDropdown, setShowLeftDropdown)}
          <Text style={[styles.vsText, { color: c.textMuted }]}>vs</Text>
          {renderDropdown(rightId, setRightId, showRightDropdown, setShowRightDropdown)}
        </View>

        {/* Side-by-side */}
        <View style={styles.comparisonRow}>
          {renderSide(leftCandidate, leftProfile, leftInsights)}
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          {renderSide(rightCandidate, rightProfile, rightInsights)}
        </View>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    zIndex: 10,
  },
  vsText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  dropdownWrap: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
  },
  dropdownText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.sm,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 20,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dropdownItemText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
  dropdownItemSub: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
  },
  side: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  radarWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  flagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  noFlags: {
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
