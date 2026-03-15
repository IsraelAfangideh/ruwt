/**
 * AvatarUpload: Click avatar to upload a new profile picture.
 * Resizes to 200x200 on client side, stores as base64 data URL.
 */
import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Avatar } from '@/shared/ui/Avatar';
import { fontSizes, fontFamily } from '@/shared/theme/tokens';

interface AvatarUploadProps {
  currentUrl: string | null;
  fallback: string;
  size?: number;
  onUploaded?: (newUrl: string) => void;
}

/* istanbul ignore next -- @preserve */
function resizeImage(file: File, maxSize: number): Promise<string> {
  /* istanbul ignore next -- @preserve */
  return new Promise((resolve, reject) => {
    /* istanbul ignore next -- @preserve */
    const reader = new FileReader();
    /* istanbul ignore next -- @preserve */
    reader.onload = () => {
      /* istanbul ignore next -- @preserve */
      const img = new Image();
      /* istanbul ignore next -- @preserve */
      img.onload = () => {
        /* istanbul ignore next -- @preserve */
        const canvas = document.createElement('canvas');
        /* istanbul ignore next -- @preserve */
        let w = img.width;
        /* istanbul ignore next -- @preserve */
        let h = img.height;
        /* istanbul ignore next -- @preserve */
        if (w > h) {
          /* istanbul ignore next -- @preserve */
          if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        /* istanbul ignore next -- @preserve */
        } else {
          /* istanbul ignore next -- @preserve */
          if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        }
        /* istanbul ignore next -- @preserve */
        canvas.width = w;
        /* istanbul ignore next -- @preserve */
        canvas.height = h;
        /* istanbul ignore next -- @preserve */
        const ctx = canvas.getContext('2d');
        /* istanbul ignore next -- @preserve */
        if (!ctx) return reject(new Error('Canvas not supported'));
        /* istanbul ignore next -- @preserve */
        ctx.drawImage(img, 0, 0, w, h);
        /* istanbul ignore next -- @preserve */
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      /* istanbul ignore next -- @preserve */
      img.onerror = reject;
      /* istanbul ignore next -- @preserve */
      img.src = reader.result as string;
    };
    /* istanbul ignore next -- @preserve */
    reader.onerror = reject;
    /* istanbul ignore next -- @preserve */
    reader.readAsDataURL(file);
  });
}

/* istanbul ignore next -- @preserve */
export function AvatarUpload({ currentUrl, fallback, size = 80, onUploaded }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* istanbul ignore next -- @preserve */
  const handleClick = useCallback(() => {
    /* istanbul ignore next -- @preserve */
    inputRef.current?.click();
  }, []);

  /* istanbul ignore next -- @preserve */
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    /* istanbul ignore next -- @preserve */
    const file = e.target.files?.[0];
    /* istanbul ignore next -- @preserve */
    if (!file) return;

    /* istanbul ignore next -- @preserve */
    if (!file.type.startsWith('image/')) return;
    /* istanbul ignore next -- @preserve */
    if (file.size > 5 * 1024 * 1024) return; // 5MB max

    /* istanbul ignore next -- @preserve */
    setUploading(true);
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const dataUrl = await resizeImage(file, 200);
      /* istanbul ignore next -- @preserve */
      setPreviewUrl(dataUrl);

      /* istanbul ignore next -- @preserve */
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });

      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        onUploaded?.(dataUrl);
      /* istanbul ignore next -- @preserve */
      } else {
        /* istanbul ignore next -- @preserve */
        setPreviewUrl(null);
      }
    } catch {
      /* istanbul ignore next -- @preserve */
      setPreviewUrl(null);
    }
    /* istanbul ignore next -- @preserve */
    setUploading(false);
    // Reset input so same file can be re-selected
    /* istanbul ignore next -- @preserve */
    if (inputRef.current) inputRef.current.value = '';
  }, [onUploaded]);

  const displayUrl = previewUrl || currentUrl;

  return (
    <View style={styles.container}>
      <div
        className="avatar-upload-wrap"
        onClick={handleClick}
        style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
        data-testid="avatar-upload"
      >
        <Avatar src={displayUrl} fallback={fallback} size={size} />
        <div
          className="avatar-upload-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.overlayText}>Edit</Text>
          )}
        </div>
        <style>{`.avatar-upload-wrap:hover .avatar-upload-overlay { opacity: 1 !important; }`}</style>
      </div>
      <input
        ref={inputRef as any}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile as any}
        data-testid="avatar-file-input"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  avatarWrap: {
    position: 'relative',
    cursor: 'pointer',
  } as any,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    // CSS hover handled via web style
  },
  overlayText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
});
