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

export function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({ currentUrl, fallback, size = 80, onUploaded }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max

    setUploading(true);
    try {
      const dataUrl = await resizeImage(file, 200);
      setPreviewUrl(dataUrl);

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });

      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        onUploaded?.(dataUrl);
      } else {
        setPreviewUrl(null);
      }
    } catch {
      /* istanbul ignore next -- @preserve */
      setPreviewUrl(null);
    }
    setUploading(false);
    // Reset input so same file can be re-selected
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
