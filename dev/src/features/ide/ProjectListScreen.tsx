/**
 * ProjectListScreen: The /ide route showing a user's projects.
 * Fetches project list from /api/projects and displays cards.
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { timeAgo } from '@/shared/lib/utils';

interface ProjectRow {
  id: string;
  name: string;
  language: string | null;
  fileCount: number | null;
  sizeBytes: number | null;
  lastOpenedAt: string | null;
  createdAt: string;
}

export function ProjectListScreen() {
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const c = useColors();
  useDocumentMeta({ title: 'My Projects — Ruwt IDE' });

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json() as { projects: ProjectRow[] };
      setProjects(data.projects);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // Swallow
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleOpenProject = useCallback((id: string) => {
    (navigation as any).navigate('IDE', { projectId: id });
  }, [navigation]);

  const handleNewProject = useCallback(() => {
    navigation.navigate('IDE' as never);
  }, [navigation]);

  if (authLoading || !user) return null;

  return (
    <DashboardLayout user={user}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text, fontFamily: fontFamily.display }]}>
            My Projects
          </Text>
          <Button
            onPress={handleNewProject}
            testID="new-project-btn"
          >
            New Project
          </Button>
        </View>

        {/* Loading state */}
        {loading && (
          <View style={styles.loadingState} testID="projects-loading">
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        )}

        {/* Error state */}
        {fetchError && !loading && (
          <Card>
            <CardContent>
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: c.error, fontFamily: fontFamily.display }]}>
                  {fetchError}
                </Text>
                <Button
                  onPress={fetchProjects}
                  variant="outline"
                  testID="retry-btn"
                >
                  Retry
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Project cards */}
        {!loading && !fetchError && projects.length > 0 && (
          <View style={styles.projectList} testID="project-list">
            {projects.map((project) => (
              <Pressable
                key={project.id}
                onPress={() => handleOpenProject(project.id)}
                testID={`project-card-${project.id}`}
              >
                <Card>
                  <CardContent>
                    <View style={styles.projectCard}>
                      <View style={styles.projectInfo}>
                        <Text style={[styles.projectName, { color: c.text, fontFamily: fontFamily.display }]}>
                          {project.name}
                        </Text>
                        <Text style={[styles.projectMeta, { color: c.textMuted, fontFamily: fontFamily.body }]}>
                          {project.fileCount ?? 0} files
                          {project.lastOpenedAt ? ` · Last opened ${timeAgo(project.lastOpenedAt)}` : ''}
                        </Text>
                      </View>
                      <Button
                        onPress={() => handleDelete(project.id)}
                        variant="outline"
                        testID={`delete-project-${project.id}`}
                        disabled={deletingId === project.id}
                      >
                        {deletingId === project.id ? '...' : 'Delete'}
                      </Button>
                    </View>
                  </CardContent>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && !fetchError && projects.length === 0 && (
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
                  onPress={handleNewProject}
                  variant="outline"
                  testID="empty-new-project-btn"
                >
                  Create Project
                </Button>
              </View>
            </CardContent>
          </Card>
        )}
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
  loadingState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  projectList: {
    gap: spacing.md,
  },
  projectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  projectName: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
  projectMeta: {
    fontSize: fontSizes.sm,
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
