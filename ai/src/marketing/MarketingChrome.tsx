import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { DownloadButton } from './DownloadButton';
import { ThemeToggle } from './ThemeToggle';
import './landing.css';

type Props = {
  children: ReactNode;
  active?: 'home' | 'blog' | 'download';
  showDownload?: boolean;
};

export function MarketingChrome({ children, active = 'home', showDownload = true }: Props) {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <div className="mk" data-theme={isDark ? 'dark' : 'light'}>
      <div className="mk-grain" aria-hidden="true" />
      <div className="mk-shell">
        <header className="mk-nav">
          <button type="button" className="mk-mark" onClick={() => navigation.navigate('Landing')}>
            ruwt
          </button>
          <nav className="mk-nav-links" aria-label="Main">
            <button
              type="button"
              className="mk-link"
              data-active={active === 'blog'}
              onClick={() => navigation.navigate('Blog')}
            >
              Blog
            </button>
            <ThemeToggle />
            {showDownload ? <DownloadButton source="header" compact /> : null}
          </nav>
        </header>
      </div>
      {children}
    </div>
  );
}
