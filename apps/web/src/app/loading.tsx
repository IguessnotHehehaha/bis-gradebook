"use client";

import { useT } from "@/lib/i18n/client";

export default function Loading() {
  const { t } = useT();

  return (
    <main className="page stack" aria-busy="true">
      <p className="muted small" role="status">{t("nav.loading")}</p>
      <div className="tiles" aria-hidden="true">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="card tile">
            <div className="mb-2 h-7 w-12 rounded bg-muted" />
            <div className="h-3 w-20 max-w-full rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="card stack" aria-hidden="true">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
      </div>
    </main>
  );
}
