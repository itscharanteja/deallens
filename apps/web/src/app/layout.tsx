import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import './globals.css';

export const metadata: Metadata = {
  title: 'DealLens — Acquisition Intelligence Platform',
  description: 'Turn lead lists into evidence-backed acquisition research priorities.',
};

const theme = createTheme({
  primaryColor: 'forest',
  colors: {
    forest: ['#eef5ef', '#dce8dd', '#b6d0bd', '#8cb59b', '#699e80', '#518e6c', '#397453', '#285d41', '#1f5037', '#12442c'],
  },
  primaryShade: 7,
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: '600' },
  components: {
    Button: { defaultProps: { size: 'sm', radius: 'md' } },
    Input: { defaultProps: { radius: 'md' } },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className="min-h-screen antialiased">
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
