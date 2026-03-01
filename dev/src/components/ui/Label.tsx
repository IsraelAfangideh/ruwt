import { useColors } from '@/theme';
import { fontSizes, fontFamily } from '@/theme/tokens';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  const c = useColors();
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: fontSizes.sm,
        fontWeight: 500,
        fontFamily: fontFamily.body,
        color: c.text,
      }}
    >
      {children}
    </label>
  );
}
