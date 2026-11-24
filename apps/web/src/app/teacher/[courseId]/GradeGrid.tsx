"use client";

import { PASS_MARK, average, isLow } from "@gradebook/shared";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { createAssessmentAction, saveScoreAction } from "../actions";

interface Props {
  courseId: number;
  students: { studentId: number; fullName: string; groupName: string }[];
  assessments: string[];
  scores: Record<string, number>;
}

const key = (studentId: number, assessment: string) => `${studentId}:${assessment}`;

/** One score box. Saves by itself when you press Enter or click away. */
function ScoreCell(props: {
  courseId: number;
  studentId: number;
  assessment: string;
  value: number | undefined;
  row: number;
  col: number;
  onSaved: (studentId: number, assessment: string, score: number) => void;
}) {
  const { courseId, studentId, assessment, value, row, col, onSaved } = props;
  const { t } = useT();
  const shown = value === undefined ? "" : String(value);
  const [text, setText] = useState(shown);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => setText(shown), [shown]);

  async function commit() {
    const entered = text.trim();
    if (entered === shown) return;
    if (entered === "") return setText(shown); // clearing a grade is not supported
    setStatus("saving");
    const res = await saveScoreAction({ courseId, studentId, assessmentName: assessment, score: entered });
    if (res.ok) {
      onSaved(studentId, assessment, res.score);
      setMessage("");
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } else {
      setMessage(res.error);
      setStatus("error");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const next = document.querySelector<HTMLInputElement>(`input[data-r="${row + delta}"][data-c="${col}"]`);
      e.preventDefault();
      if (next) next.focus();
      else if (e.key === "Enter") e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setText(shown);
      setStatus("idle");
    }
  }

  const low = value !== undefined && isLow(value);
  return (
    <td className={"cell" + (low ? " low" : "") + (status === "error" ? " bad" : "")}>
      <input
        value={text}
        inputMode="decimal"
        placeholder="–"
        aria-label={t("grid.cell.aria", { assessment })}
        data-r={row}
        data-c={col}
        onFocus={(e) => e.currentTarget.select()}
        aria-invalid={status === "error"}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {low && status !== "error" && <span className="flag" title={t("grid.cell.belowTitle", { mark: PASS_MARK })}>▼</span>}
      {status === "saving" && <span className="state">{t("grid.cell.saving")}</span>}
      {status === "saved" && <span className="state ok">{t("grid.cell.saved")}</span>}
      {status === "error" && (
        <span className="state err" role="alert">
          {message}
        </span>
      )}
    </td>
  );
}

export function GradeGrid({ courseId, students, assessments, scores: initial }: Props) {
  const { t } = useT();
  const [scores, setScores] = useState(initial);
  const [extra, setExtra] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [formError, setFormError] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");

  const columns = [...new Set([...assessments, ...extra])];
  const values = Object.values(scores);
  const lowTotal = values.filter(isLow).length;
  const hasLow = (studentId: number) =>
    columns.some((a) => scores[key(studentId, a)] !== undefined && isLow(scores[key(studentId, a)]));
  const groups = [...new Set(students.map((s) => s.groupName))].sort();
  const visible = students.filter(
    (s) =>
      (!onlyLow || hasLow(s.studentId)) &&
      (!group || s.groupName === group) &&
      s.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const overallAvg = average(values);
  const colAvg = (a: string) =>
    average(students.map((s) => scores[key(s.studentId, a)]).filter((v): v is number => v !== undefined));

  async function addColumn(e: FormEvent) {
    e.preventDefault();
    if (adding) return;
    const name = newName.trim();
    if (!name) return;
    if (name.length > 60) return setFormError(t("grid.error.nameLong"));
    if (columns.some((c) => c.toLowerCase() === name.toLowerCase())) return setFormError(t("grid.error.exists"));
    setAdding(true);
    try {
      const result = await createAssessmentAction(courseId, name);
      if (!result.ok) { setFormError(result.error); return; }
      setExtra((previous) => [...previous, name]);
    } catch {
      setFormError(t("grid.error.saveFailed"));
      return;
    } finally { setAdding(false); }
    setNewName("");
    setFormError("");
  }

  return (
    <div className="stack">
      <div className="tiles">
        <div className="card tile"><p className="big">{students.length}</p><p className="muted">{t("grid.tile.students")}</p></div>
        <div className="card tile"><p className="big">{columns.length}</p><p className="muted">{t("grid.tile.assessments")}</p></div>
        <div className="card tile"><p className="big">{overallAvg ?? t("common.none")}</p><p className="muted">{t("grid.tile.average")}</p></div>
        <div className="card tile">
          <p className={"big" + (lowTotal ? " low" : "")}>{lowTotal}</p>
          <p className="muted">{t("grid.tile.below", { mark: PASS_MARK })}</p>
        </div>
      </div>

      <div className="toolbar card">
        <label className="grow">
          {t("grid.find")}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("grid.findPlaceholder")} />
        </label>
        <label>
          {t("grid.group")}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{t("grid.allGroups")}</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          {t("grid.onlyLow", { mark: PASS_MARK })}
        </label>
      </div>

      <div className="table-wrap card">
        <table className="gradegrid">
          <thead>
            <tr>
              <th>{t("grid.student")}</th>
              {columns.map((c) => (
                <th key={c} className="num">{c}</th>
              ))}
              <th className="num">{t("grid.average")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, row) => {
              const own = columns.map((a) => scores[key(s.studentId, a)]).filter((v): v is number => v !== undefined);
              return (
                <tr key={s.studentId}>
                  <th scope="row">
                    {s.fullName} <span className="muted small">{s.groupName}</span>
                  </th>
                  {columns.map((a, col) => (
                    <ScoreCell
                      key={a}
                      row={row}
                      col={col}
                      courseId={courseId}
                      studentId={s.studentId}
                      assessment={a}
                      value={scores[key(s.studentId, a)]}
                      onSaved={(sid, assessment, score) => setScores((prev) => ({ ...prev, [key(sid, assessment)]: score }))}
                    />
                  ))}
                  <td className={"num avgcell" + (average(own) !== null && isLow(average(own)!) ? " low" : "")}>{average(own) ?? t("common.none")}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="muted">
                  {students.length === 0
                    ? t("grid.noEnrolled")
                    : t("grid.noMatch")}
                </td>
              </tr>
            )}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row">{t("grid.avgAll")}</th>
                {columns.map((c) => (
                  <td key={c} className="num">{colAvg(c) ?? t("common.none")}</td>
                ))}
                <td className="num avgcell">{overallAvg ?? t("common.none")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <form onSubmit={addColumn} className="addcol">
        <label>
          {t("grid.add")}
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("grid.addPlaceholder")}
            maxLength={60}
            disabled={adding}
          />
        </label>
        <button type="submit" className="primary" disabled={adding}>{adding ? t("grid.saving") : t("grid.addButton")}</button>
        {formError && <span className="error" role="alert">{formError}</span>}
      </form>

      <p className="hint">{t("grid.hint", { mark: PASS_MARK })}</p>
    </div>
  );
}
