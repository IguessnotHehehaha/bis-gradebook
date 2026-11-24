"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScrubPagination } from "@/components/ui/scrub-pagination";
import { useT } from "@/lib/i18n/client";

export function AdminPagination({ page, pageCount, href }: { page: number; pageCount: number; href: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (pageCount < 2) return null;

  return (
    <ScrubPagination
      page={page}
      pageCount={pageCount}
      aria-busy={pending}
      labels={{
        previous: t("admin.grades.previous"),
        next: t("admin.grades.next"),
        pageOf: (page, total) => t("admin.grades.page", { page, total }),
        valueText: (page, total) => t("admin.grades.page", { page, total }),
        page: (page) => t("admin.pagination.number", { page }),
        scrub: t("admin.pagination.scrub"),
        jumpTo: t("admin.pagination.jump"),
        pagination: t("admin.pagination.label"),
      }}
      onPageChange={(next) => {
        const params = new URLSearchParams(href);
        params.set("page", String(next));
        startTransition(() => router.push(`/admin?${params}`, { scroll: false }));
      }}
    />
  );
}
