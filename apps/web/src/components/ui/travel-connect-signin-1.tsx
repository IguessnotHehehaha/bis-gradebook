"use client";

import { ArrowRight, Eye, EyeOff, GraduationCap } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

const continents = [
  "M23 81 49 49 108 40 143 67 121 84 110 116 86 122 70 148 53 120 33 111Z",
  "M90 150 129 150 153 173 145 210 115 256 106 219 98 190Z",
  "M167 96 188 67 214 64 235 88 218 111 184 113Z",
  "M175 122 221 116 241 146 217 202 190 210 179 173 157 151Z",
  "M212 81 245 52 303 44 342 65 358 91 332 120 302 123 286 152 266 134 242 142 229 110Z",
  "M287 184 325 174 349 195 344 223 306 223 285 208Z",
];

const routes = [
  [[77, 99], [137, 68], [190, 91]],
  [[190, 91], [250, 33], [315, 89]],
  [[112, 187], [166, 239], [205, 156]],
  [[315, 89], [363, 133], [321, 202]],
];

function DotMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const background = document.createElement("canvas");
    const dots = background.getContext("2d");
    if (!dots) return;
    background.width = canvas.width;
    background.height = canvas.height;
    const outlines = continents.map((outline) => new Path2D(outline));

    dots.scale(2, 2);
    dots.fillStyle = "#4979d4";
    for (let y = 40; y < 260; y += 6) {
      for (let x = 20; x < 360; x += 6) {
        if (!outlines.some((outline) => dots.isPointInPath(outline, x * 2, y * 2))) continue;
        dots.globalAlpha = (x + y) % 5 === 0 ? 0.65 : 0.34;
        dots.beginPath();
        dots.arc(x, y, 1, 0, Math.PI * 2);
        dots.fill();
      }
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number;
    const started = performance.now();
    function draw(now: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(background, 0, 0);
      ctx.save();
      ctx.scale(2, 2);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#5286eb";
      ctx.fillStyle = "#3471e1";

      routes.forEach(([start, bend, end], index) => {
        const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (now - started - index * 180) / 1000));
        const leftover = 1 - progress;
        const controlX = start[0] + (bend[0] - start[0]) * progress;
        const controlY = start[1] + (bend[1] - start[1]) * progress;
        const x = leftover ** 2 * start[0] + 2 * leftover * progress * bend[0] + progress ** 2 * end[0];
        const y = leftover ** 2 * start[1] + 2 * leftover * progress * bend[1] + progress ** 2 * end[1];
        ctx.beginPath();
        ctx.moveTo(start[0], start[1]);
        ctx.quadraticCurveTo(controlX, controlY, x, y);
        ctx.stroke();
        for (const [px, py] of [start, [x, y]]) {
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
      if (!reducedMotion.matches && now - started < 1540) frame = requestAnimationFrame(draw);
    }

    const desktop = window.matchMedia("(min-width: 768px)");
    function update() {
      cancelAnimationFrame(frame);
      if (desktop.matches) draw(performance.now());
    }
    update();
    desktop.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      desktop.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={760}
      height={560}
      aria-hidden="true"
      className="pointer-events-none w-full max-w-[380px]"
    />
  );
}

export function SignInButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-0 bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-blue-800 hover:to-indigo-800 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  );
}

const signInField = "min-h-11 w-full rounded-lg border border-solid border-input bg-background px-3 text-sm text-foreground";

export function SignInFields({ email, password, show, hide, registration = false }: {
  email: string;
  password: string;
  show: string;
  hide: string;
  registration?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  return (
    <>
      <label htmlFor={emailId}>
        {email}
        <input id={emailId} name="email" type="email" maxLength={254} autoComplete="username" spellCheck={false} required className={signInField} />
      </label>
      <div className="grid gap-1">
        <label htmlFor={passwordId}>{password}</label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={registration ? "new-password" : "current-password"}
            minLength={registration ? 8 : undefined}
            maxLength={registration ? 72 : undefined}
            required
            className={cn(signInField, "pr-12")}
          />
          <button
            type="button"
            onClick={() => setVisible((previous) => !previous)}
            aria-controls={passwordId}
            aria-label={visible ? hide : show}
            title={visible ? hide : show}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground focus-visible:-outline-offset-2"
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );
}

export default function SignInCard({ appName, description, title, intro, error, children }: {
  appName: string;
  description: string;
  title: string;
  intro: string;
  error?: string;
  children: ReactNode;
}) {

  return (
    <main className="grid min-h-[calc(100svh-5rem)] place-items-center px-4 py-8 sm:px-8 md:py-12">
      <section
        aria-labelledby="signin-title"
        className="signin-card-enter grid w-full max-w-4xl overflow-hidden rounded-2xl border border-solid border-border bg-card text-card-foreground md:min-h-[31rem] md:grid-cols-2"
      >
        <div className="hidden flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50 to-indigo-100 px-6 py-7 text-center dark:from-slate-900 dark:to-indigo-950 md:flex">
          <DotMap />
          <div className="mb-1 grid size-10 place-items-center rounded-lg bg-blue-700 text-white dark:bg-blue-200 dark:text-blue-950">
            <GraduationCap size={22} aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-blue-950 dark:text-blue-50">{appName}</p>
          <p className="max-w-64 text-sm leading-relaxed text-blue-950/80 dark:text-blue-100">{description}</p>
        </div>
        <div className="flex flex-col justify-center px-6 py-9 sm:px-10 md:px-12">
          <h1 id="signin-title" className="m-0 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">{intro}</p>
          {error && <p role="alert" className="mb-4 rounded-lg border border-solid border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
