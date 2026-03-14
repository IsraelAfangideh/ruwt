import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';

interface Invite {
  id: string;
  candidateEmail: string | null;
  candidateName: string | null;
  token: string;
  status: string;
  expiresAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  createdAt: string;
}

interface Props {
  assessmentId: string;
  refreshKey?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#6b6560', bg: '#6b656015' },
  started: { label: 'Started', color: '#c9a962', bg: '#c9a96215' },
  completed: { label: 'Completed', color: '#5a8a5a', bg: '#5a8a5a15' },
  expired: { label: 'Expired', color: '#b06060', bg: '#b0606015' },
};

export function InviteManagementTable({ assessmentId, refreshKey }: Props) {
  const c = useColors();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [remindResult, setRemindResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInvites = useCallback(async () => {
    setFetchError(false);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites`);
      if (res.ok) setInvites(await res.json());
      else setFetchError(true);
    } catch { setFetchError(true); }
    setLoading(false);
  }, [assessmentId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites, refreshKey]);

  const handleCopyLink = useCallback(async (token: string) => {
    const url = `${window.location.origin}/assess/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  const handleRemind = useCallback(async (inviteId: string) => {
    setReminding(inviteId);
    setRemindResult(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteIds: [inviteId] }),
      });
      if (res.ok) {
        setRemindResult({ type: 'success', text: 'Reminder sent' });
        fetchInvites();
      } else {
        setRemindResult({ type: 'error', text: 'Failed to send reminder' });
      }
    } catch {
      setRemindResult({ type: 'error', text: 'Network error' });
    }
    setReminding(null);
    setTimeout(() => setRemindResult(null), 3000);
  }, [assessmentId, fetchInvites]);

  const handleRemindAll = useCallback(async () => {
    setReminding('all');
    setRemindResult(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setRemindResult({ type: 'success', text: 'Reminders sent to all pending' });
        fetchInvites();
      } else {
        setRemindResult({ type: 'error', text: 'Failed to send reminders' });
      }
    } catch {
      setRemindResult({ type: 'error', text: 'Network error' });
    }
    setReminding(null);
    setTimeout(() => setRemindResult(null), 3000);
  }, [assessmentId, fetchInvites]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={c.accent} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.empty, { borderColor: c.destructive + '40' }]}>
        <Text style={{ color: c.destructive, fontSize: fontSizes.sm, marginBottom: spacing.xs }}>
          Failed to load invites.
        </Text>
        <Pressable onPress={fetchInvites} accessibilityRole="button" accessibilityLabel="Retry loading invites">
          <Text style={{ fontSize: fontSizes.xs, color: c.accent, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (invites.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: c.border }]}>
        <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>
          No invites generated yet. Use the invite tools above to add candidates.
        </Text>
      </View>
    );
  }

  const pendingCount = invites.filter((i) => i.status === 'pending').length;

  return (
    <View>
      {remindResult && (
        <Text style={{
          fontSize: fontSizes.xs,
          color: remindResult.type === 'success' ? c.success : c.destructive,
          marginBottom: spacing.xs,
          fontWeight: '600',
        }}>
          {remindResult.text}
        </Text>
      )}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionLabel, { color: c.text }]}>
          Candidate Invites ({invites.length})
        </Text>
        {pendingCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onPress={handleRemindAll}
            disabled={reminding === 'all'}
          >
            {reminding === 'all' ? 'Sending...' : `Remind All Pending (${pendingCount})`}
          </Button>
        )}
      </View>

      {/* Table header */}
      <View style={[styles.row, styles.tableHeader, { borderBottomColor: c.border }]}>
        <Text style={[styles.cellEmail, styles.headerText, { color: c.textMuted }]}>Email</Text>
        <Text style={[styles.cellStatus, styles.headerText, { color: c.textMuted }]}>Status</Text>
        <Text style={[styles.cellDate, styles.headerText, { color: c.textMuted }]}>Created</Text>
        <Text style={[styles.cellDate, styles.headerText, { color: c.textMuted }]}>Expires</Text>
        <Text style={[styles.cellActions, styles.headerText, { color: c.textMuted }]}>Actions</Text>
      </View>

      {/* Rows */}
      {invites.map((inv) => {
        const sc = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.pending;
        const isExpiringSoon = inv.expiresAt &&
          new Date(inv.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
        const canRemind = inv.status === 'pending' && inv.candidateEmail;

        return (
          <View
            key={inv.id}
            style={[
              styles.row,
              { borderBottomColor: c.border },
              inv.status === 'completed' && { backgroundColor: c.success + '08' },
            ]}
          >
            <Text style={[styles.cellEmail, { color: c.text }]} numberOfLines={1}>
              {inv.candidateEmail || '(no email)'}
            </Text>
            <View style={styles.cellStatus}>
              <Badge variant="outline" style={{ borderColor: sc.color, backgroundColor: sc.bg }}>
                <Text style={{ fontSize: 11, color: sc.color, fontWeight: '600' }}>{sc.label}</Text>
              </Badge>
            </View>
            <Text style={[styles.cellDate, { color: c.textMuted }]}>
              {new Date(inv.createdAt).toLocaleDateString()}
            </Text>
            <Text
              style={[
                styles.cellDate,
                { color: isExpiringSoon ? c.destructive : c.textMuted },
              ]}
            >
              {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '—'}
            </Text>
            <View style={[styles.cellActions, { flexDirection: 'row', gap: spacing.xs }]}>
              <Pressable
                onPress={() => handleCopyLink(inv.token)}
                accessibilityRole="button"
                accessibilityLabel="Copy invite link"
                style={[styles.actionBtn, { borderColor: c.border }]}
              >
                <Text style={{ fontSize: 11, color: c.textMuted }}>
                  {copied === inv.token ? 'Copied!' : 'Copy Link'}
                </Text>
              </Pressable>
              {canRemind && (
                <Pressable
                  onPress={() => handleRemind(inv.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Send reminder email"
                  style={[styles.actionBtn, { borderColor: c.accent + '40' }]}
                  disabled={reminding === inv.id}
                >
                  <Text style={{ fontSize: 11, color: c.accent }}>
                    {reminding === inv.id ? '...' : 'Remind'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: spacing.lg, alignItems: 'center' },
  empty: { padding: spacing.lg, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: { fontSize: fontSizes.md, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  tableHeader: { paddingVertical: spacing.xs },
  headerText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as any },
  cellEmail: { flex: 3, fontSize: fontSizes.sm },
  cellStatus: { flex: 1.5 },
  cellDate: { flex: 1.5, fontSize: fontSizes.xs },
  cellActions: { flex: 2, alignItems: 'flex-end' },
  actionBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
});
