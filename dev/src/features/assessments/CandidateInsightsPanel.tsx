/**
 * CandidateInsightsPanel: Rich expanded view for a candidate in the results dashboard.
 * Shows AI profile radar, behavioral flags, narrative insights, comparative bars,
 * per-challenge breakdown, and highlight reel.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from '@/shared/ui/Badge';
import { AIProfileRadar, type AIProfile } from '@/features/profile/AIProfileRadar';
import { PercentileBar } from '@/features/assessments/PercentileBar';
import { HighlightReel, type HighlightMoment } from '@/features/assessments/HighlightReel';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';

interface BehavioralInsight {
  type: string;
  severity: 'green' | 'yellow' | 'red';
  narrative: string;
  challengeIndex: number;
  timestamp: string;
}

interface ComparativeMetric {
  metric: string;
  candidateValue: number;
  medianValue: number;
  percentile: number;
  narrative: string;
}

interface FlagSummary {
  green: string[];
  red: string[];
  yellow: string[];
}

interface CandidateInsightsPanelProps {
  profile?: AIProfile;
  insights: BehavioralInsight[];
  comparatives: ComparativeMetric[];
  flags: FlagSummary;
  highlights: HighlightMoment[];
  formatCost: (cost: number) => string;
}

export function CandidateInsightsPanel({
  profile,
  insights,
  comparatives,
  flags,
  highlights,
  formatCost,
}: CandidateInsightsPanelProps) {
  const c = useColors();

  const hasFlags = flags.green.length > 0 || flags.red.length > 0 || flags.yellow.length > 0;
  // Select the most important narrative insights (up to 4)
  const topInsights = insights
    .filter((i) => i.challengeIndex === -1 || i.severity !== 'yellow')
    .slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Top row: Radar + Flags */}
      <View style={styles.topRow}>
        {profile && (
          <View style={styles.radarSection}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>AI Profile</Text>
            <AIProfileRadar profile={profile} size={220} />
          </View>
        )}

        <View style={styles.flagsSection}>
          {hasFlags && (
            <>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Signals</Text>
              <View style={styles.flagGroup}>
                {flags.green.map((f) => (
                  <Badge key={f} variant="outline" style={[styles.flagBadge, { borderColor: '#5a8a5a', backgroundColor: 'rgba(90,138,90,0.1)' }]}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a' }}>{f}</Text>
                  </Badge>
                ))}
                {flags.yellow.map((f) => (
                  <Badge key={f} variant="outline" style={[styles.flagBadge, { borderColor: '#e5a639', backgroundColor: 'rgba(229,166,57,0.1)' }]}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#e5a639' }}>{f}</Text>
                  </Badge>
                ))}
                {flags.red.map((f) => (
                  <Badge key={f} variant="outline" style={[styles.flagBadge, { borderColor: '#c87878', backgroundColor: 'rgba(200,120,120,0.1)' }]}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#c87878' }}>{f}</Text>
                  </Badge>
                ))}
              </View>
            </>
          )}

          {/* Narrative insights */}
          {topInsights.length > 0 && (
            <View style={styles.narrativeSection}>
              <Text style={[styles.sectionTitle, { color: c.text, marginTop: spacing.md }]}>Behavioral Insights</Text>
              {topInsights.map((insight, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={[styles.insightDot, {
                    backgroundColor: insight.severity === 'green' ? '#5a8a5a' : insight.severity === 'red' ? '#c87878' : '#e5a639',
                  }]} />
                  <Text style={[styles.insightText, { color: c.textMuted }]}>
                    {insight.narrative}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Comparative bars */}
      {comparatives.length > 0 && (
        <View style={styles.comparativeSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>vs. Candidate Pool</Text>
          {comparatives.map((cm) => (
            <PercentileBar
              key={cm.metric}
              label={cm.metric}
              value={cm.percentile}
              narrative={cm.narrative}
              displayValue={
                cm.metric === 'AI Cost' ? formatCost(cm.candidateValue) :
                cm.metric === 'Token Usage' ? cm.candidateValue.toLocaleString() :
                cm.metric === 'Speed' && cm.candidateValue > 0 ? `${Math.round(cm.candidateValue / 60000)}m` :
                undefined
              }
            />
          ))}
        </View>
      )}

      {/* Highlight reel */}
      {highlights.length > 0 && (
        <View style={styles.highlightSection}>
          <HighlightReel highlights={highlights} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  radarSection: {
    alignItems: 'center',
    minWidth: 240,
  },
  flagsSection: {
    flex: 1,
    minWidth: 280,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    marginBottom: spacing.sm,
  },
  flagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  flagBadge: {
    borderWidth: 1,
  },
  narrativeSection: {
    marginTop: spacing.xs,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  insightText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 20,
    flex: 1,
  },
  comparativeSection: {
    paddingTop: spacing.sm,
  },
  highlightSection: {
    paddingTop: spacing.xs,
  },
});
