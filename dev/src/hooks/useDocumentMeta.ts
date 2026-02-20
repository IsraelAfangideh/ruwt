import { useEffect } from 'react';

const DEFAULT_TITLE = 'Ruwt - Prove You Can Use AI Better Than Anyone';
const DEFAULT_DESC = 'Compete in AI-powered coding challenges. 60+ real-world problems, 8 AI models, ranked by cost efficiency. Free to start with 50k credits.';
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
