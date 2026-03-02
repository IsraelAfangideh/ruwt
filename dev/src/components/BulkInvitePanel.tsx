import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface Props {
  assessmentId: string;
  onInvitesSent: () => void;
}

interface InviteResult {
  email: string;
  status: 'created' | 'failed';
  emailSent?: boolean;
  error?: string;
}

function parseEmails(text: string): string[] {
  return text
    .split(/[,;\n\r]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export function BulkInvitePanel({ assessmentId, onInvitesSent }: Props) {
  const c = useColors();
  const [emailText, setEmailText] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);

  const emails = parseEmails(emailText);

  const handleCSVUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setCsvInfo(null);
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      // Try to find email column header (matches "email", "e-mail", "email address", etc.)
      const headers = lines[0]?.toLowerCase().split(',') ?? [];
      const emailIdx = headers.findIndex((h) => /e[-_]?mail/.test(h.trim()));
      const dataLines = emailIdx >= 0 ? lines.slice(1) : lines;
      const colIdx = emailIdx >= 0 ? emailIdx : 0;
      const rawEntries = dataLines.map((line) => {
        const cols = line.split(',');
        return (cols[colIdx] ?? '').trim().replace(/^"|"$/g, '');
      });
      const parsed = rawEntries.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      const rejected = rawEntries.length - parsed.length;
      setEmailText((prev) => {
        const existing = parseEmails(prev);
        const merged = [...new Set([...existing, ...parsed])];
        return merged.join('\n');
      });
      const info = `Imported ${parsed.length} email${parsed.length !== 1 ? 's' : ''} from ${file.name}`;
      setCsvInfo(rejected > 0 ? `${info} (${rejected} invalid row${rejected !== 1 ? 's' : ''} skipped)` : info);
    };
    input.click();
  }, []);

  const handleSend = useCallback(async () => {
    if (emails.length === 0) return;
    setSending(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create invites');
      } else {
        setResults(data.results);
        onInvitesSent();
      }
    } catch {
      setError('Network error');
    }
    setSending(false);
  }, [emails, assessmentId, onInvitesSent]);

  const created = results?.filter((r) => r.status === 'created').length ?? 0;
  const emailed = results?.filter((r) => r.emailSent).length ?? 0;

  return (
    <Card style={{ borderColor: c.border }}>
      <CardContent>
        <Text style={[styles.label, { color: c.text }]}>Bulk Invite Candidates</Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Paste email addresses separated by commas, semicolons, or new lines.
        </Text>

        <TextInput
          style={[
            styles.textarea,
            {
              color: c.text,
              backgroundColor: c.bgWarm,
              borderColor: c.border,
            },
          ]}
          multiline
          numberOfLines={5}
          placeholder="alice@example.com&#10;bob@example.com&#10;carol@example.com"
          placeholderTextColor={c.textSubtle}
          value={emailText}
          onChangeText={setEmailText}
        />

        <View style={styles.actionRow}>
          <Button variant="outline" size="sm" onPress={handleCSVUpload}>
            Upload CSV
          </Button>
          <Text style={[styles.countLabel, { color: c.textMuted }]}>
            {emails.length} valid email{emails.length !== 1 ? 's' : ''} detected
          </Text>
        </View>
        {csvInfo && (
          <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginBottom: spacing.sm }}>{csvInfo}</Text>
        )}

        <Button
          onPress={handleSend}
          disabled={sending || emails.length === 0}
        >
          {sending ? 'Sending Invites...' : `Send ${emails.length} Invite${emails.length !== 1 ? 's' : ''}`}
        </Button>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: c.destructive + '15', borderColor: c.destructive + '30' }]}>
            <Text style={{ color: c.destructive, fontSize: fontSizes.sm }}>{error}</Text>
          </View>
        )}

        {results && (
          <View style={[styles.resultsBanner, { backgroundColor: c.success + '15', borderColor: c.success + '30' }]}>
            <Text style={{ color: c.success, fontSize: fontSizes.sm, fontWeight: '600' }}>
              {created} invite{created !== 1 ? 's' : ''} created, {emailed} email{emailed !== 1 ? 's' : ''} sent
            </Text>
            {results.filter((r) => r.status === 'failed').length > 0 && (
              <View style={{ marginTop: spacing.xs }}>
                <Text style={{ color: c.destructive, fontSize: fontSizes.xs, fontWeight: '600' }}>
                  {results.filter((r) => r.status === 'failed').length} failed:
                </Text>
                {results.filter((r) => r.status === 'failed').map((r, i) => (
                  <Text key={i} style={{ color: c.destructive, fontSize: fontSizes.xs }}>
                    {r.email}{r.error ? ` — ${r.error}` : ''}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSizes.md, fontWeight: '600', marginBottom: spacing.xs },
  hint: { fontSize: fontSizes.sm, marginBottom: spacing.sm, fontFamily: fontFamily.body },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    minHeight: 100,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  countLabel: { fontSize: fontSizes.sm },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: spacing.sm,
  },
  resultsBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: spacing.sm,
  },
});
