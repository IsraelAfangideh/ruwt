// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', card: '#fff', muted: '#ddd',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

import {
  CardGridSkeleton,
  TableSkeleton,
  DetailCardSkeleton,
  ProfileSkeleton,
  SplitPaneSkeleton,
  FormSkeleton,
  CommentListSkeleton,
} from './ScreenSkeletons';

describe('ScreenSkeletons', () => {
  it('renders CardGridSkeleton with testID', () => {
    const { getByTestId } = render(<CardGridSkeleton />);
    expect(getByTestId('skeleton-card-grid')).toBeTruthy();
  });

  it('renders CardGridSkeleton with custom card count', () => {
    const { getByTestId } = render(<CardGridSkeleton cards={2} />);
    expect(getByTestId('skeleton-card-grid')).toBeTruthy();
  });

  it('renders TableSkeleton with testID', () => {
    const { getByTestId } = render(<TableSkeleton />);
    expect(getByTestId('skeleton-table')).toBeTruthy();
  });

  it('renders TableSkeleton with custom row count', () => {
    const { getByTestId } = render(<TableSkeleton rows={3} />);
    expect(getByTestId('skeleton-table')).toBeTruthy();
  });

  it('renders DetailCardSkeleton with testID', () => {
    const { getByTestId } = render(<DetailCardSkeleton />);
    expect(getByTestId('skeleton-detail')).toBeTruthy();
  });

  it('renders ProfileSkeleton with testID', () => {
    const { getByTestId } = render(<ProfileSkeleton />);
    expect(getByTestId('skeleton-profile')).toBeTruthy();
  });

  it('renders SplitPaneSkeleton with testID', () => {
    const { getByTestId } = render(<SplitPaneSkeleton />);
    expect(getByTestId('skeleton-split-pane')).toBeTruthy();
  });

  it('renders FormSkeleton with testID', () => {
    const { getByTestId } = render(<FormSkeleton />);
    expect(getByTestId('skeleton-form')).toBeTruthy();
  });

  it('renders FormSkeleton with custom field count', () => {
    const { getByTestId } = render(<FormSkeleton fields={2} />);
    expect(getByTestId('skeleton-form')).toBeTruthy();
  });

  it('renders CommentListSkeleton with testID', () => {
    const { getByTestId } = render(<CommentListSkeleton />);
    expect(getByTestId('skeleton-comments')).toBeTruthy();
  });

  it('renders CommentListSkeleton with custom count', () => {
    const { getByTestId } = render(<CommentListSkeleton count={5} />);
    expect(getByTestId('skeleton-comments')).toBeTruthy();
  });
});
