import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useToast } from '@/components/ui/Toast';
import type { TrialInfo } from '@/components/TrialBanner';

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Org {
  id: string;
  name: string;
  logoUrl: string | null;
  domain: string | null;
  assessmentCredits: number;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionEndsAt: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#c9a962',
  admin: '#7ab87a',
  member: '#6b9bd2',
  viewer: '#8a847a',
};

export function OrgManagementScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const { showToast } = useToast();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [userRole, setUserRole] = useState<string>('viewer');

  // Settings form
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Billing
  const [billingLoading, setBillingLoading] = useState(false);

  // Trial status
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  // Create org form
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/orgs');
      if (!res.ok) return;
      const orgs = await res.json();
      if (orgs.length > 0) {
        const o = orgs[0];
        setOrg(o);
        setOrgName(o.name);
        setOrgLogoUrl(o.logoUrl || '');
        setUserRole(o.role);
        // Fetch members
        const memRes = await fetch(`/api/orgs/${o.id}/members`);
        if (memRes.ok) setMembers(await memRes.json());
        // Fetch invitations
        const invRes = await fetch(`/api/orgs/${o.id}/invitations`);
        if (invRes.ok) setInvitations(await invRes.json());
        // Fetch trial status
        const trialRes = await fetch('/api/trial/status');
        if (trialRes.ok) {
          const trialData = await trialRes.json();
          if (trialData.trial) setTrial(trialData.trial);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      await fetchOrg();
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, fetchOrg]);

  const handleCreateOrg = useCallback(async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (res.ok) {
        await fetchOrg();
        setCreateName('');
      }
    } catch {}
    setCreating(false);
  }, [createName, fetchOrg]);

  const handleSaveSettings = useCallback(async () => {
    if (!org) return;
    setSaving(true);
    try {
      await fetch(`/api/orgs/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, logoUrl: orgLogoUrl || null }),
      });
      await fetchOrg();
    } catch {}
    setSaving(false);
  }, [org, orgName, orgLogoUrl, fetchOrg]);

  const handleInvite = useCallback(async () => {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch(`/api/orgs/${org.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteSuccess(true);
        setInviteEmail('');
        await fetchOrg();
        setTimeout(() => setInviteSuccess(false), 3000);
      } else {
        const data = await res.json();
        setInviteError(data.error || 'Failed to send invitation');
      }
    } catch {
      setInviteError('Network error');
    }
    setInviting(false);
  }, [org, inviteEmail, inviteRole, fetchOrg]);

  const handleRevokeInvite = useCallback(async (invitationId: string) => {
    if (!org) return;
    await fetch(`/api/orgs/${org.id}/invitations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    });
    await fetchOrg();
  }, [org, fetchOrg]);

  const handleChangeRole = useCallback(async (userId: string, newRole: string) => {
    if (!org) return;
    await fetch(`/api/orgs/${org.id}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await fetchOrg();
  }, [org, fetchOrg]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!org) return;
    await fetch(`/api/orgs/${org.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    await fetchOrg();
  }, [org, fetchOrg]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // No org yet — show create form
  if (!org) {
    return (
      <DashboardLayout user={user} requireOrg>
        <View style={styles.createSection}>
          <Text style={[styles.pageTitle, { color: c.text }]}>Create Your Team</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Set up an organization to collaborate with your hiring team and share assessments.
          </Text>
          <View style={styles.createForm}>
            <Input
              label="Organization Name"
              placeholder="Acme Corp Engineering"
              value={createName}
              onChangeText={setCreateName}
            />
            <Button onPress={handleCreateOrg} disabled={creating || !createName.trim()}>
              {creating ? 'Creating...' : 'Create Organization'}
            </Button>
          </View>
        </View>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} requireOrg>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('Assessments' as never)}
        >
          ← Back to Assessments
        </Button>
        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: c.text }]}>{org.name}</Text>
          <View style={styles.creditsBadge}>
            {org.subscriptionStatus === 'active' ? (
              <>
                <Badge variant="default" style={{ backgroundColor: '#5a8a5a' }}>
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>
                    Active — {org.subscriptionPlan === 'annual' ? 'Annual' : 'Monthly'}
                  </Text>
                </Badge>
                {org.subscriptionEndsAt && (
                  <Text style={[styles.creditsLabel, { color: c.textMuted }]}>
                    Renews {new Date(org.subscriptionEndsAt).toLocaleDateString()}
                  </Text>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={billingLoading}
                  onPress={async () => {
                    setBillingLoading(true);
                    try {
                      const res = await fetch('/api/billing/portal', { method: 'POST' });
                      const data = await res.json() as { url?: string; error?: string };
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                      showToast(data.error ?? 'Failed to open billing portal', 'error');
                    } catch {
                      showToast('Failed to open billing portal', 'error');
                    }
                    setBillingLoading(false);
                  }}
                >
                  {billingLoading ? 'Loading…' : 'Manage Billing'}
                </Button>
              </>
            ) : org.subscriptionStatus === 'canceled' ? (
              <>
                <Badge variant="outline" style={{ borderColor: c.destructive }}>
                  <Text style={{ fontSize: 11, color: c.destructive, fontWeight: '600' }}>
                    Canceled
                  </Text>
                </Badge>
                {org.subscriptionEndsAt && new Date(org.subscriptionEndsAt) > new Date() && (
                  <Text style={[styles.creditsLabel, { color: c.textMuted }]}>
                    Access until {new Date(org.subscriptionEndsAt).toLocaleDateString()}
                  </Text>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => navigation.navigate('Hiring' as never)}
                >
                  Resubscribe
                </Button>
              </>
            ) : org.subscriptionStatus === 'past_due' ? (
              <>
                <Badge variant="outline" style={{ borderColor: '#d4a843' }}>
                  <Text style={{ fontSize: 11, color: '#d4a843', fontWeight: '600' }}>
                    Payment Past Due
                  </Text>
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={billingLoading}
                  onPress={async () => {
                    setBillingLoading(true);
                    try {
                      const res = await fetch('/api/billing/portal', { method: 'POST' });
                      const data = await res.json() as { url?: string; error?: string };
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                      showToast(data.error ?? 'Failed to open billing portal', 'error');
                    } catch {
                      showToast('Failed to open billing portal', 'error');
                    }
                    setBillingLoading(false);
                  }}
                >
                  {billingLoading ? 'Loading…' : 'Update Payment'}
                </Button>
              </>
            ) : trial && trial.isActive ? (
              <>
                <Badge variant="default" style={{ backgroundColor: '#c9a962' }}>
                  <Text style={{ fontSize: 11, color: '#1a1816', fontWeight: '600' }}>
                    Free Trial — {trial.daysRemaining} day{trial.daysRemaining !== 1 ? 's' : ''} left
                  </Text>
                </Badge>
                <Text style={[styles.creditsLabel, { color: c.textMuted }]}>
                  {trial.assessmentsUsed}/{trial.assessmentsLimit} assessments | {trial.invitesUsed}/{trial.invitesLimit} invites
                </Text>
                <Button
                  size="sm"
                  onPress={() => navigation.navigate('Hiring' as never)}
                >
                  Subscribe
                </Button>
              </>
            ) : trial && !trial.isActive ? (
              <>
                <Badge variant="outline" style={{ borderColor: c.destructive }}>
                  <Text style={{ fontSize: 11, color: c.destructive, fontWeight: '600' }}>
                    Trial Expired
                  </Text>
                </Badge>
                <Button
                  size="sm"
                  onPress={() => navigation.navigate('Hiring' as never)}
                >
                  Subscribe
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onPress={() => navigation.navigate('Hiring' as never)}
              >
                Subscribe
              </Button>
            )}
          </View>
        </View>
      </View>

      {/* Org Settings */}
      {isAdmin && (
        <Card style={[styles.section, { borderColor: c.border }]}>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.form}>
              <Input
                label="Organization Name"
                value={orgName}
                onChangeText={setOrgName}
              />
              <Input
                label="Logo URL (optional)"
                placeholder="https://example.com/logo.png"
                value={orgLogoUrl}
                onChangeText={setOrgLogoUrl}
              />
              <Button onPress={handleSaveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card style={[styles.section, { borderColor: c.border }]}>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.map((m) => (
            <View key={m.id} style={[styles.memberRow, { borderBottomColor: c.border }]}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: c.text }]}>
                  {m.name || m.email}
                </Text>
                {m.name && (
                  <Text style={[styles.memberEmail, { color: c.textMuted }]}>{m.email}</Text>
                )}
              </View>
              <Badge
                variant="outline"
                style={{ borderColor: ROLE_COLORS[m.role] || c.border }}
              >
                <Text style={{ fontSize: 11, color: ROLE_COLORS[m.role] || c.textMuted, fontWeight: '600' }}>
                  {m.role.toUpperCase()}
                </Text>
              </Badge>
              {isAdmin && m.role !== 'owner' && m.userId !== user.id && (
                <View style={styles.memberActions}>
                  {m.role !== 'admin' && (
                    <Pressable
                      onPress={() => handleChangeRole(m.userId, 'admin')}
                      style={[styles.actionLink]}
                    >
                      <Text style={{ fontSize: 11, color: c.accent }}>Make Admin</Text>
                    </Pressable>
                  )}
                  {m.role === 'admin' && (
                    <Pressable
                      onPress={() => handleChangeRole(m.userId, 'member')}
                      style={styles.actionLink}
                    >
                      <Text style={{ fontSize: 11, color: c.textMuted }}>Demote</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => handleRemoveMember(m.userId)}
                    style={styles.actionLink}
                  >
                    <Text style={{ fontSize: 11, color: c.destructive }}>Remove</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </CardContent>
      </Card>

      {/* Invite Team Member */}
      {isAdmin && (
        <Card style={[styles.section, { borderColor: c.border }]}>
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.inviteForm}>
              <View style={{ flex: 2 }}>
                <Input
                  label="Email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                />
              </View>
              <View style={styles.roleSelector}>
                <Text style={[styles.roleLabel, { color: c.textMuted }]}>Role:</Text>
                {(['member', 'admin', 'viewer'] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[
                      styles.roleOption,
                      {
                        borderColor: inviteRole === r ? c.accent : c.border,
                        backgroundColor: inviteRole === r ? c.accent + '20' : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: fontSizes.xs,
                        color: inviteRole === r ? c.accent : c.textMuted,
                        fontWeight: inviteRole === r ? '600' : '400',
                      }}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                onPress={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </View>
            {inviteError && (
              <Text style={{ color: c.destructive, fontSize: fontSizes.sm, marginTop: spacing.xs }}>
                {inviteError}
              </Text>
            )}
            {inviteSuccess && (
              <Text style={{ color: c.success, fontSize: fontSizes.sm, marginTop: spacing.xs }}>
                Invitation sent!
              </Text>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card style={[styles.section, { borderColor: c.border }]}>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.map((inv) => (
              <View key={inv.id} style={[styles.memberRow, { borderBottomColor: c.border }]}>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: c.text }]}>{inv.email}</Text>
                  <Text style={[styles.memberEmail, { color: c.textMuted }]}>
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <Badge variant="outline" style={{ borderColor: ROLE_COLORS[inv.role] || c.border }}>
                  <Text style={{ fontSize: 11, color: ROLE_COLORS[inv.role] || c.textMuted }}>
                    {inv.role.toUpperCase()}
                  </Text>
                </Badge>
                {isAdmin && inv.status === 'pending' && (
                  <Pressable
                    onPress={() => handleRevokeInvite(inv.id)}
                    style={styles.actionLink}
                  >
                    <Text style={{ fontSize: 11, color: c.destructive }}>Revoke</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pageTitle: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.md, marginBottom: spacing.lg, fontFamily: fontFamily.body },
  creditsBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creditsLabel: { fontSize: fontSizes.sm },
  creditsValue: { fontSize: fontSizes.lg, fontWeight: '700' },
  section: { marginBottom: spacing.lg },
  form: { gap: spacing.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: fontSizes.sm, fontWeight: '500' },
  memberEmail: { fontSize: fontSizes.xs },
  memberActions: { flexDirection: 'row', gap: spacing.sm },
  actionLink: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  inviteForm: { gap: spacing.md },
  roleSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roleLabel: { fontSize: fontSizes.sm, fontWeight: '500' },
  roleOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: 6,
  },
  createSection: { paddingVertical: spacing.xl },
  createForm: { gap: spacing.md, maxWidth: 400 },
});
