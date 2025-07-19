'use client'

// ThemeProvider is now a passthrough since dark theme is removed.
export function ThemeProvider({ children }) {
  return <>{children}</>;
}
