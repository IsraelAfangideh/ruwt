import 'vitest';

declare module '@vitest/expect' {
  interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
}
