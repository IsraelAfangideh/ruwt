import { useEffect } from 'react';

const DEFAULT_TITLE = 'Ruwt - Get Better at AI Coding. Get Discovered.';
const DEFAULT_DESC = 'Practice AI-assisted coding with real models. 100+ challenges, community replays, and hints. Build your skills, get noticed by employers.';
const SITE = 'https://ruwt.dev';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  canonicalPath?: string;
}

export function useDocumentMeta({ title, description, canonicalPath }: DocumentMetaOptions) {
  useEffect(() => {
    document.title = title ? `${title} | Ruwt` : DEFAULT_TITLE;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) {
      metaDesc.setAttribute('content', description);
    }

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical && canonicalPath !== undefined) {
      canonical.href = `${SITE}${canonicalPath}`;
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (metaDesc) metaDesc.setAttribute('content', DEFAULT_DESC);
      if (canonical) canonical.href = `${SITE}/`;
    };
  }, [title, description, canonicalPath]);
}
