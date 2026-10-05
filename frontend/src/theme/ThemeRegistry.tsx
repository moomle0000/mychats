'use client';

import React, { useState } from 'react';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import { ColorModeProvider } from './ColorModeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const c = createCache({ key: 'mui', prepend: true });
    c.compat = true;
    const prevInsert = c.insert;
    let inserted: string[] = [];
    c.insert = (...args) => {
      const serialized = args[1];
      if (c.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const f = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache: c, flush: f };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) {
      return null;
    }
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <CacheProvider value={cache}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ColorModeProvider>{children}</ColorModeProvider>
      </GoogleOAuthProvider>
    </CacheProvider>
  );
}
