"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScrubPaginationItem = number | "start-ellipsis" | "end-ellipsis";
export type ScrubPaginationLabels = {
  previous?: React.ReactNode;
  next?: React.ReactNode;
  pageOf?: (page: number, count: number) => string;
  valueText?: (page: number, count: number) => string;
  page?: (page: number) => string;
  jumpTo?: string;
  scrub?: string;
  pagination?: string;
};

type ScrubPaginationProps = React.ComponentProps<"nav"> & {
  page?: number;
  defaultPage?: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  onScrub?: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  showTrack?: boolean;
  showSummary?: boolean;
  tickEvery?: number;
  labels?: ScrubPaginationLabels;
  size?: "sm" | "md";
  onInteractionStart?: (event: React.SyntheticEvent) => void;
};

const defaultLabels = {
  previous: "Prev",
  next: "Next",
  pageOf: (page: number, count: number) => `Page ${page} / ${count}`,
  valueText: (page: number, count: number) => `Page ${page} of ${count}`,
  page: (page: number) => `Page ${page}`,
  jumpTo: "Jump to page",
  scrub: "Scrub through pages",
  pagination: "Pagination",
};
const whole = (number: number, fallback: number) => Number.isFinite(number) ? Math.floor(number) : fallback;
const clamp = (page: number, count: number) => Math.min(count, Math.max(1, whole(page, 1)));

export function paginationRange(page: number, pageCount: number, siblingCount = 1, boundaryCount = 1): ScrubPaginationItem[] {
  const count = Math.max(1, whole(pageCount, 1));
  const current = clamp(page, count);
  const siblings = Math.max(0, whole(siblingCount, 1));
  const boundary = Math.max(1, whole(boundaryCount, 1));
  const range = (start: number, end: number) =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
  const width = 2 * siblings + 1;
  if (count <= width + 2 * boundary + 2) return range(1, count);

  const start = Math.max(boundary + 2, Math.min(current - siblings, count - boundary - width));
  const end = start + width - 1;
  return [
    ...range(1, boundary),
    start === boundary + 2 ? boundary + 1 : "start-ellipsis",
    ...range(start, end),
    end === count - boundary - 1 ? count - boundary : "end-ellipsis",
    ...range(count - boundary + 1, count),
  ];
}

export function ScrubPagination({
  page: controlledPage,
  defaultPage = 1,
  pageCount,
  onPageChange,
  onScrub,
  siblingCount = 1,
  boundaryCount = 1,
  showTrack = true,
  showSummary = true,
  tickEvery = 10,
  labels: customLabels,
  size = "md",
  onInteractionStart,
  onPointerDownCapture,
  onKeyDownCapture,
  className,
  ...props
}: ScrubPaginationProps) {
  const labels = { ...defaultLabels, ...customLabels };
  const count = Math.max(1, whole(pageCount, 1));
  const [localPage, setLocalPage] = React.useState(defaultPage);
  const page = clamp(controlledPage ?? localPage, count);
  const [preview, setPreview] = React.useState<number | null>(null);
  const [jump, setJump] = React.useState<ScrubPaginationItem | null>(null);
  const [compact, setCompact] = React.useState(true);
  const row = React.useRef<HTMLDivElement>(null);
  const pages = React.useRef<HTMLDivElement>(null);
  const pill = React.useRef<HTMLSpanElement>(null);
  const drag = React.useRef(false);
  const jumpButton = React.useRef<HTMLButtonElement>(null);
  const visible = preview ?? page;
  const percent = count > 1 ? 100 * (visible - 1) / (count - 1) : 0;
  const tick = Math.max(0, whole(tickEvery, 10));
  const keyStep = tick || 10;
  const tickStep = tick ? tick * Math.max(1, Math.ceil(count / tick / 30)) : 0;
  const ticks = tickStep ? Array.from({ length: Math.floor((count - 2) / tickStep) }, (_, index) => (index + 1) * tickStep + 1) : [];
  const items = paginationRange(page, count, compact ? 0 : siblingCount, boundaryCount);

  React.useEffect(() => {
    if (!row.current) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 520));
    observer.observe(row.current);
    return () => observer.disconnect();
  }, []);

  React.useLayoutEffect(() => {
    const update = () => {
      const list = pages.current;
      const indicator = pill.current;
      const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!list || !indicator || !active) return;
      indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.height = `${active.offsetHeight}px`;
      list.dataset.ready = "true";
    };

    update();
    const list = pages.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [page, count, compact, siblingCount, boundaryCount, size]);

  function commit(value: number) {
    const target = clamp(value, count);
    if (target === page) return;
    if (controlledPage === undefined) setLocalPage(target);
    onPageChange?.(target);
  }

  const control = cn(
    "inline-flex min-h-9 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md border-0 bg-transparent px-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors max-sm:min-h-11",
    size === "sm" ? "text-xs" : "text-[13px]",
  );

  return (
    <nav
      {...props}
      aria-label={labels.pagination}
      data-slot="scrub-pagination"
      data-page={page}
      data-count={count}
      className={cn("w-full min-w-0", className)}
      onPointerDownCapture={(event) => { onInteractionStart?.(event); onPointerDownCapture?.(event); }}
      onKeyDownCapture={(event) => { onInteractionStart?.(event); onKeyDownCapture?.(event); }}
    >
      <div ref={row} className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <button type="button" data-prev className={control} disabled={page === 1} aria-label={typeof labels.previous === "string" ? labels.previous : undefined} onClick={() => commit(page - 1)}>
          <ChevronLeft aria-hidden="true" size={15} />
          <span className="hidden sm:inline">{labels.previous}</span>
        </button>
        <div ref={pages} className="scrub-pages relative flex flex-wrap items-center gap-0.5">
          <span ref={pill} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-md bg-primary motion-safe:transition-[transform,width] motion-safe:duration-200" />
          {items.map((item) => typeof item === "number" ? (
            <button
              key={item} type="button" data-page={item} aria-label={labels.page(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(control, "relative tabular-nums", item === page && "text-primary-foreground hover:bg-transparent hover:text-primary-foreground")}
              onClick={() => commit(item)}
            >
              {item}
            </button>
          ) : (
            <button key={item} type="button" className={control} aria-label={labels.jumpTo} aria-expanded={jump === item} onClick={(event) => {
              jumpButton.current = event.currentTarget;
              setJump(jump === item ? null : item);
            }}>…</button>
          ))}
        </div>
        <button type="button" data-next className={control} disabled={page === count} aria-label={typeof labels.next === "string" ? labels.next : undefined} onClick={() => commit(page + 1)}>
          <span className="hidden sm:inline">{labels.next}</span>
          <ChevronRight aria-hidden="true" size={15} />
        </button>
        {showSummary && <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground" aria-hidden="true">{page} / {count}</span>}
      </div>
      {jump && (
        <input
          type="text" inputMode="numeric" autoComplete="off" autoFocus maxLength={String(count).length}
          aria-label={labels.jumpTo} placeholder={String(page)}
          className="mt-2 min-h-9 w-24 rounded-md bg-background text-sm text-foreground"
          onBlur={() => setJump(null)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== "Escape") return;
            event.preventDefault();
            const value = event.currentTarget.value.trim();
            if (event.key === "Enter" && !/^\d+$/.test(value)) {
              event.currentTarget.select();
              return;
            }
            if (event.key === "Enter") commit(Number(value));
            setJump(null);
            jumpButton.current?.focus();
          }}
        />
      )}
      {showTrack && count > 1 && (
        <div className="relative mt-5">
          <input
            type="range" min={1} max={count} step={1} value={visible}
            aria-label={labels.scrub} aria-valuetext={labels.valueText(visible, count)}
            className="scrub-track peer block w-full touch-none"
            style={{ "--scrub-progress": `${percent}%` } as React.CSSProperties}
            onPointerDown={() => { drag.current = true; }}
            onPointerUp={(event) => {
              drag.current = false;
              commit(event.currentTarget.valueAsNumber);
              setPreview(null);
            }}
            onPointerCancel={() => { drag.current = false; setPreview(null); }}
            onChange={(event) => {
              const next = event.currentTarget.valueAsNumber;
              if (drag.current) {
                setPreview(next);
                onScrub?.(next);
              } else {
                commit(next);
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "PageUp" && event.key !== "PageDown") return;
              event.preventDefault();
              commit(page + (event.key === "PageUp" ? keyStep : -keyStep));
            }}
          />
          {ticks.length > 0 && (
            <div className="pointer-events-none absolute inset-x-[14px] top-1/2" aria-hidden="true">
              {ticks.map((tick) => (
                <i key={tick} className="absolute size-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" style={{ left: `${100 * (tick - 1) / (count - 1)}%` }} />
              ))}
            </div>
          )}
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute bottom-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs tabular-nums text-background", preview === null && "invisible peer-focus-visible:visible peer-hover:visible")}
            style={{ left: `clamp(3.25rem, ${percent}%, calc(100% - 3.25rem))`, transform: "translateX(-50%)" }}
          >
            {labels.pageOf(visible, count)}
          </span>
        </div>
      )}
      <p role="status" className="sr-only">{labels.valueText(page, count)}</p>
    </nav>
  );
}

export default ScrubPagination;
