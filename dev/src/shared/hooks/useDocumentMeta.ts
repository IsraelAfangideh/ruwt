import { useEffect } from 'react';

const DEFAULT_TITLE = 'Ruwt - Get Better at AI Coding. Get Discovered.';
const DEFAULT_DESC = 'Practice AI-assisted coding with real models. 100+ challenges, community replays, and hints. Build your skills, get noticed by employers.';
const SITE = 'https://ruwt.dev';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
}

export function useDocumentMeta({ title, description, canonicalPath, ogImage }: DocumentMetaOptions) {
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

    // OG image meta tag
    if (ogImage) {
      let ogMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      if (!ogMeta) {
        ogMeta = document.createElement('meta');
        ogMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogMeta);
      }
      ogMeta.setAttribute('content', ogImage);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (metaDesc) metaDesc.setAttribute('content', DEFAULT_DESC);
      if (canonical) canonical.href = `${SITE}/`;
      const ogMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      if (ogMeta && ogImage) ogMeta.setAttribute('content', `${SITE}/og-image.png`);
    };
  }, [title, description, canonicalPath, ogImage]);
}
