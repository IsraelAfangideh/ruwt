/**
 * ProjectListScreen: The /ide route showing a user's projects.
 * Placeholder for now — R2 persistence will be added later.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';

export function ProjectListScreen() {
  const { user, loading } = useAuthGuard();
  const navigation = useNavigation();
  const c = useColors();
  useDocumentMeta({ title: 'My Projects — Ruwt IDE' });

  if (loading || !user) return null;

  return (
    <DashboardLayout user={user}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text, fontFamily: fontFamily.display }]}>
            My Projects
          </Text>
          <Button
            onPress={() => navigation.navigate('IDE' as never)}
            testID="new-project-btn"
          >
            New Project
          </Button>
        </View>

        {/* Empty state */}
        <Card>
          <CardContent>
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: c.textMuted }]}>
                {'</>'}
              </Text>
              <Text style={[styles.emptyTitle, { color: c.text, fontFamily: fontFamily.display }]}>
                No projects yet
              </Text>
              <Text style={[styles.emptyDescription, { color: c.textMuted, fontFamily: fontFamily.body }]}>
                No projects yet. Create your first project to get started.
              </Text>
              <Button
                onPress={() => navigation.navigate('IDE' as never)}
                variant="outline"
                testID="empty-new-project-btn"
              >
                Create Project
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
  },
  emptyDescription: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    maxWidth: 400,
  },
});
