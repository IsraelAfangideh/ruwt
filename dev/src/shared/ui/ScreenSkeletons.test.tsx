// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    expect(getByTestId('skeleton-card-grid')).toBeInTheDocument();
  });

  it('renders CardGridSkeleton with custom card count', () => {
    const { getByTestId } = render(<CardGridSkeleton cards={2} />);
    expect(getByTestId('skeleton-card-grid')).toBeInTheDocument();
  });

  it('renders TableSkeleton with testID', () => {
    const { getByTestId } = render(<TableSkeleton />);
    expect(getByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('renders TableSkeleton with custom row count', () => {
    const { getByTestId } = render(<TableSkeleton rows={3} />);
    expect(getByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('renders DetailCardSkeleton with testID', () => {
    const { getByTestId } = render(<DetailCardSkeleton />);
    expect(getByTestId('skeleton-detail')).toBeInTheDocument();
  });

  it('renders ProfileSkeleton with testID', () => {
    const { getByTestId } = render(<ProfileSkeleton />);
    expect(getByTestId('skeleton-profile')).toBeInTheDocument();
  });

  it('renders SplitPaneSkeleton with testID', () => {
    const { getByTestId } = render(<SplitPaneSkeleton />);
    expect(getByTestId('skeleton-split-pane')).toBeInTheDocument();
  });

  it('renders FormSkeleton with testID', () => {
    const { getByTestId } = render(<FormSkeleton />);
    expect(getByTestId('skeleton-form')).toBeInTheDocument();
  });

  it('renders FormSkeleton with custom field count', () => {
    const { getByTestId } = render(<FormSkeleton fields={2} />);
    expect(getByTestId('skeleton-form')).toBeInTheDocument();
  });

  it('renders CommentListSkeleton with testID', () => {
    const { getByTestId } = render(<CommentListSkeleton />);
    expect(getByTestId('skeleton-comments')).toBeInTheDocument();
  });

  it('renders CommentListSkeleton with custom count', () => {
    const { getByTestId } = render(<CommentListSkeleton count={5} />);
    expect(getByTestId('skeleton-comments')).toBeInTheDocument();
  });
});
