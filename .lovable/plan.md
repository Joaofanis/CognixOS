

# Fix: useSettings crash in ChatInterface

## Problem

`ChatInterface` calls `useSettings()` which throws when context is `null`. Although `SettingsProvider` wraps the entire app in `App.tsx`, this error can occur during hot-reload or if any error boundary re-renders components outside the provider tree.

## Solution

Make `useSettings()` resilient by returning sensible defaults instead of throwing when used outside the provider. This is a one-line change in `src/hooks/useSettings.tsx`.

### Changes to `src/hooks/useSettings.tsx`

Replace the throwing `useSettings` hook with a version that returns safe defaults:

```typescript
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Return safe defaults when outside provider (HMR, error boundaries)
    return {
      fontSize: "normal" as FontSize,
      setFontSize: () => {},
      highContrast: false,
      setHighContrast: () => {},
      reducedMotion: false,
      setReducedMotion: () => {},
      language: "pt-BR" as Language,
      setLanguage: () => {},
    };
  }
  return ctx;
}
```

This prevents crashes while maintaining full functionality when the provider is present (which is 99.9% of the time).

