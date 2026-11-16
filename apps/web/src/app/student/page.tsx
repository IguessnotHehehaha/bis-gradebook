import { getStudentGrades, type StudentGradeRow } from "@gradebook/db";
import { PASS_MARK, average, isLow } from "@gradebook/shared";
import { requireRole } from "@/lib/session";

export default async function StudentPage() {
  const user = await requireRole("student");
  const rows = await getStudentGrades(user.id, user.studentId!);

  const byCourse = new Map<number, StudentGradeRow[]>();
  for (const r of rows) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);

  const lowCount = rows.filter((r) => isLow(r.score)).length;
  const overall = average(rows.map((r) => r.score));

  return (
    <main className="page stack">
      <div>
        <h1>My grades</h1>
        <p className="muted">
          {rows.length === 0
            ? "No grades have been entered yet."
            : `${rows.length} results · overall average ${overall} · ${lowCount} below ${PASS_MARK}`}
        </p>
        {lowCount > 0 && (
          <p className="notice">
            Results below {PASS_MARK} are marked. If you want help, talk to the teacher of that course.
          </p>
        )}
      </div>

      {[...byCourse.values()].map((list) => (
        <section key={list[0].courseId} className="card stack">
          <div className="row between">
            <div>
              <h2>{list[0].courseName}</h2>
              <p className="muted">
                {list[0].teacherName} · {list[0].semester}
              </p>
            </div>
            <p className="avg">
              Average <b>{average(list.map((r) => r.score))}</b>
            </p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Date</th>
                <th className="num">Score</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.gradeId}>
                  <td>{r.assessmentName}</td>
                  <td className="muted">{r.gradeDate}</td>
                  <td className={"num" + (isLow(r.score) ? " low" : "")}>
                    {r.score}
                    {isLow(r.score) && <span className="tag">Below {PASS_MARK}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
