"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AttestationSummary } from "@gradebook/db";
import { attestationAverage } from "@gradebook/shared/scoring";
import { useT } from "@/lib/i18n/client";
import { saveAttestationAction } from "../actions";

function AttestationCell({ courseId, studentId, name, number, value, onSaved }: {
  courseId: number; studentId: number; name: string; number: 1 | 2; value: number | null;
  onSaved: (value: number) => void;
}) {
  const { t } = useT();
  const [text, setText] = useState(value === null ? "" : String(value));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => { setText(value === null ? "" : String(value)); }, [value]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    try {
      const result = await saveAttestationAction({ courseId, studentId, attestationNumber: number, score: text });
      if (!result.ok) { setStatus("error"); return; }
      onSaved(Number(text.trim().replace(",", ".")));
      setStatus("saved");
    } catch { setStatus("error"); }
  }
  return <td className="num">
    <form onSubmit={save} className="stack">
      <input aria-label={`${name}: ${t(number === 1 ? "feature.first" : "feature.second")}`} inputMode="decimal"
        placeholder="—" value={text} required disabled={status === "saving"}
        onChange={(e) => { setText(e.target.value); setStatus("idle"); }} style={{ width: "6rem", alignSelf: "flex-end" }} />
      <button className="primary" type="submit" disabled={status === "saving"}>{t(status === "saving" ? "feature.saving" : "feature.save")}</button>
      {status === "saved" && <span className="success" role="status">{t("feature.saved")}</span>}
      {status === "error" && <span className="error" role="alert">{t("feature.saveFailed")}</span>}
    </form>
  </td>;
}

export function AttestationGrid({ courseId, students, initial }: {
  courseId: number; students: { studentId: number; fullName: string; groupName: string }[]; initial: AttestationSummary[];
}) {
  const { t } = useT();
  const [results, setResults] = useState(initial);
  useEffect(() => { setResults(initial); }, [initial]);
  function update(studentId: number, number: 1 | 2, value: number) {
    setResults((previous) => {
      const result = previous.find((r) => r.studentId === studentId) ?? { studentId, courseId, first: null, second: null, average: null };
      const next = { ...result, [number === 1 ? "first" : "second"]: value };
      next.average = attestationAverage(next.first, next.second);
      return [...previous.filter((r) => r.studentId !== studentId), next];
    });
  }
  return <section className="card stack">
    <h2>{t("feature.attestations")}</h2><p className="muted">{t("feature.rule")}</p>
    <div className="table-wrap"><table>
      <thead><tr><th>{t("grid.student")}</th><th className="num">{t("feature.first")}</th><th className="num">{t("feature.second")}</th><th className="num">{t("feature.average")}</th></tr></thead>
      <tbody>{students.map((s) => {
        const result = results.find((r) => r.studentId === s.studentId);
        return <tr key={s.studentId}><th scope="row">{s.fullName}<span className="muted small block">{s.groupName}</span></th>
          <AttestationCell courseId={courseId} studentId={s.studentId} name={s.fullName} number={1} value={result?.first ?? null} onSaved={(v) => update(s.studentId, 1, v)} />
          <AttestationCell courseId={courseId} studentId={s.studentId} name={s.fullName} number={2} value={result?.second ?? null} onSaved={(v) => update(s.studentId, 2, v)} />
          <td className="num avgcell">{result?.average ?? "—"}</td></tr>;
      })}{students.length === 0 && <tr><td colSpan={4}>{t("grid.noEnrolled")}</td></tr>}</tbody>
    </table></div>
  </section>;
}
