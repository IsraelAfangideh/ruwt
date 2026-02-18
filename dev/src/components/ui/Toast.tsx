import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

type ToastVariant = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  removing: boolean;
}

interface ToastContextType {
  showToast: (message: string, variant: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const c = useColors();
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    // Start fade-out animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    // Remove from DOM after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, variant, removing: false }]);
    const timer = setTimeout(() => {
      removeToast(id);
      timersRef.current.delete(id);
    }, 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const getVariantColors = (variant: ToastVariant) => {
    switch (variant) {
      case 'error':
        return { bg: c.errorBg, border: c.error, text: c.error };
      case 'success':
        return { bg: c.successBg, border: c.success, text: c.success };
      case 'info':
        return { bg: c.accentBg, border: c.accent, text: c.accent };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed top-right */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: spacing.md,
            right: spacing.md,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            pointerEvents: 'none',
            maxWidth: 400,
          }}
        >
          {toasts.map((toast) => {
            const vc = getVariantColors(toast.variant);
            return (
              <div
                key={toast.id}
                style={{
                  background: c.bgElevated,
                  borderLeft: `3px solid ${vc.border}`,
                  borderRadius: radii.md,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: fontFamily.body,
                  fontSize: fontSizes.sm,
                  color: vc.text,
                  lineHeight: '1.4',
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  opacity: toast.removing ? 0 : 1,
                  transform: toast.removing ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'opacity 250ms ease, transform 250ms ease',
                  animation: toast.removing ? undefined : 'toast-slide-in 250ms ease',
                }}
                onClick={() => {
                  const timer = timersRef.current.get(toast.id);
                  if (timer) {
                    clearTimeout(timer);
                    timersRef.current.delete(toast.id);
                  }
                  removeToast(toast.id);
                }}
              >
                {toast.message}
              </div>
            );
          })}
        </div>
      )}
      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
