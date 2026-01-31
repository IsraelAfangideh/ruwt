import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from './Toast';
import type { ToastType } from './Toast';

type ToastShowOptions = {
  duration?: number;
  type?: ToastType;
};

type ToastContextValue = {
  show: (message: string, options?: ToastShowOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastDuration, setToastDuration] = useState<number>(2000);
  const [toastType, setToastType] = useState<ToastType>('info');

  const dismiss = useCallback(() => {
    setToastVisible(false);
  }, []);

  const show = useCallback((message: string, options?: ToastShowOptions) => {
    setToastMessage(message);
    setToastDuration(options?.duration ?? 2000);
    setToastType(options?.type ?? 'info');
    // Force "re-show" even if a toast is already visible.
    setToastVisible(false);
    requestAnimationFrame(() => setToastVisible(true));
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        duration={toastDuration}
        type={toastType}
        onDismiss={dismiss}
        topOffset={insets.top + 12}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

