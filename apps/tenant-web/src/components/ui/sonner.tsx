'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** App-wide toast host — themed with next-themes, rendered once in providers. */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps['theme']) ?? 'system'}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border shadow-lg',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
