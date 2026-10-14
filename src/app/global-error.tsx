"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Sentry hook point: if NEXT_PUBLIC_SENTRY_DSN is set, report `error` here.
    console.error("[global error]", error);
  }, [error]);

  // Renders without globals.css/providers, so styles are inline and follow the OS scheme.
  return (
    <html lang="es">
      <head>
        <title>Algo salió mal · Finanzas</title>
        <style>{`
          body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
            font-family:system-ui,sans-serif;background:#f6f5f8;color:#17151c;text-align:center;padding:16px}
          p{margin:8px 0;font-size:14px;opacity:.7}
          h1{font-size:18px;margin:0}
          a,button{display:inline-block;margin:8px 4px 0;min-height:44px;padding:0 16px;border-radius:12px;
            font:600 13px system-ui,sans-serif;cursor:pointer;line-height:44px;text-decoration:none;
            border:1px solid #8884;background:transparent;color:inherit}
          @media (prefers-color-scheme:dark){body{background:#0a0e13;color:#f4f6f8}}
        `}</style>
      </head>
      <body>
        <main role="alert">
          <h1>Algo salió mal</h1>
          <p>Ocurrió un error inesperado. Tus datos no se han modificado.</p>
          <button type="button" onClick={() => retry()}>Reintentar</button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Ir a Inicio</a>
        </main>
      </body>
    </html>
  );
}
