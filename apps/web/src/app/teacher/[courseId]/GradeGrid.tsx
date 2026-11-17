"use client";

import { PASS_MARK, average, isLow } from "@gradebook/shared";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
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
  onSaved: (studentId: number, assessment: string, score: number) => void;
}) {
  const { courseId, studentId, assessment, value, onSaved } = props;
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
    if (e.key === "Enter") e.currentTarget.blur();
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
        aria-label={`${assessment} score`}
        aria-invalid={status === "error"}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {low && status !== "error" && <span className="flag" title={`Below ${PASS_MARK}`}>▼</span>}
      {status === "saving" && <span className="state">saving…</span>}
      {status === "saved" && <span className="state ok">saved ✓</span>}
      {status === "error" && (
        <span className="state err" role="alert">
          {message}
        </span>
      )}
    </td>
  );
}

export function GradeGrid({ courseId, students, assessments, scores: initial }: Props) {
  const [scores, setScores] = useState(initial);
  const [extra, setExtra] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [formError, setFormError] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const columns = [...new Set([...assessments, ...extra])];
  const values = Object.values(scores);
  const lowTotal = values.filter(isLow).length;
  const hasLow = (studentId: number) =>
    columns.some((a) => scores[key(studentId, a)] !== undefined && isLow(scores[key(studentId, a)]));
  const visible = onlyLow ? students.filter((s) => hasLow(s.studentId)) : students;

  async function addColumn(e: FormEvent) {
    e.preventDefault();
    if (adding) return;
    const name = newName.trim();
    if (!name) return;
    if (name.length > 60) return setFormError("Keep the name under 60 characters.");
    if (columns.some((c) => c.toLowerCase() === name.toLowerCase())) return setFormError("That assessment already exists.");
    setAdding(true);
    try {
      const result = await createAssessmentAction(courseId, name);
      if (!result.ok) { setFormError(result.error); return; }
      setExtra((previous) => [...previous, name]);
    } catch {
      setFormError("Could not save the assessment. Please try again.");
      return;
    } finally { setAdding(false); }
    setNewName("");
    setFormError("");
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <p className="stats">
          <span><b>{students.length}</b> students</span>
          <span><b>{values.length}</b> grades</span>
          <span className={lowTotal ? "low-text" : ""}><b>{lowTotal}</b> below {PASS_MARK}</span>
        </p>
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Only students with a result below {PASS_MARK}
        </label>
      </div>

      <div className="table-wrap card">
        <table className="gradegrid">
          <thead>
            <tr>
              <th>Student</th>
              {columns.map((c) => (
                <th key={c} className="num">{c}</th>
              ))}
              <th className="num">Average</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const own = columns.map((a) => scores[key(s.studentId, a)]).filter((v): v is number => v !== undefined);
              return (
                <tr key={s.studentId}>
                  <th scope="row">
                    {s.fullName} <span className="muted small">{s.groupName}</span>
                  </th>
                  {columns.map((a) => (
                    <ScoreCell
                      key={a}
                      courseId={courseId}
                      studentId={s.studentId}
                      assessment={a}
                      value={scores[key(s.studentId, a)]}
                      onSaved={(sid, assessment, score) => setScores((prev) => ({ ...prev, [key(sid, assessment)]: score }))}
                    />
                  ))}
                  <td className="num avgcell">{average(own) ?? "–"}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="muted">
                  {onlyLow ? `Nobody has a result below ${PASS_MARK}.` : "No students are enrolled in this course yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={addColumn} className="addcol">
        <label>
          Add an assessment
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Midterm, then press Enter"
            maxLength={60}
            disabled={adding}
          />
        </label>
        <button type="submit" className="primary" disabled={adding}>{adding ? "Saving…" : "Add assessment"}</button>
        {formError && <span className="error" role="alert">{formError}</span>}
      </form>

      <p className="hint">
        Click a score to change it; it saves when you press Enter or click away. ▼ and red mean below {PASS_MARK}.
        Only students enrolled in this course appear here.
      </p>
    </div>
  );
}
