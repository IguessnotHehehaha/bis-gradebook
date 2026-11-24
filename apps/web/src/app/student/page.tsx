import { getStudentGrades, type StudentGradeRow } from "@gradebook/db";
import { PASS_MARK, average, isLow } from "@gradebook/shared";
import { getT } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";
import { ScoreChart } from "./ScoreChart";

export default async function StudentPage() {
  const user = await requireRole("student");
  const { t } = await getT();
  const rows = await getStudentGrades(user.id, user.studentId!);

  const byCourse = new Map<number, StudentGradeRow[]>();
  for (const r of rows) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);
  const courses = [...byCourse.values()];

  const lowCount = rows.filter((r) => isLow(r.score)).length;
  const overall = average(rows.map((r) => r.score));

  const summary = courses.map((list) => {
    const scores = list.map((r) => r.score);
    return {
      courseId: list[0].courseId,
      courseName: list[0].courseName,
      teacherName: list[0].teacherName,
      semester: list[0].semester,
      count: list.length,
      avg: average(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
      low: scores.filter(isLow).length,
    };
  });

  if (rows.length === 0) {
    return (
      <main className="page stack">
        <h1>{t("student.title")}</h1>
        <p className="card muted">{t("student.empty")}</p>
      </main>
    );
  }

  return (
    <main className="page stack">
      <div>
        <h1>{t("student.title")}</h1>
        <p className="muted">{t("student.subtitle")}</p>
      </div>

      <div className="tiles">
        <div className="card tile">
          <p className="big">{overall}</p>
          <p className="muted">{t("student.tile.average")}</p>
        </div>
        <div className="card tile">
          <p className="big">{courses.length}</p>
          <p className="muted">{t("student.tile.subjects")}</p>
        </div>
        <div className="card tile">
          <p className="big">{rows.length}</p>
          <p className="muted">{t("student.tile.results")}</p>
        </div>
        <div className="card tile">
          <p className={"big" + (lowCount > 0 ? " low" : "")}>{lowCount}</p>
          <p className="muted">{t("student.tile.below", { mark: PASS_MARK })}</p>
        </div>
      </div>

      {lowCount > 0 && (
        <p className="notice" role="note">
          {t("student.lowNote", { mark: PASS_MARK })}
        </p>
      )}

      <section className="card stack" aria-labelledby="overall-h">
        <h2 id="overall-h">{t("student.summary.title")}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("student.summary.subject")}</th>
                <th>{t("student.summary.teacher")}</th>
                <th className="num">{t("student.summary.results")}</th>
                <th className="num">{t("student.summary.lowest")}</th>
                <th className="num">{t("student.summary.highest")}</th>
                <th className="num">{t("student.summary.average")}</th>
                <th>{t("student.summary.status")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.courseId}>
                  <th scope="row">
                    <a href={`#course-${s.courseId}`}>{s.courseName}</a>
                    <span className="muted small block">{s.semester}</span>
                  </th>
                  <td>{s.teacherName}</td>
                  <td className="num">{s.count}</td>
                  <td className={"num" + (isLow(s.min) ? " low" : "")}>{s.min}</td>
                  <td className="num">{s.max}</td>
                  <td className={"num avgcell" + (s.avg !== null && isLow(s.avg) ? " low" : "")}>{s.avg}</td>
                  <td>
                    {s.low > 0 ? (
                      <span className="tag nomargin">{t("student.summary.belowCount", { n: s.low, mark: PASS_MARK })}</span>
                    ) : (
                      <span className="tag good nomargin">{t("student.summary.onTrack")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>{t("student.summary.all")}</th>
                <td className="num">{rows.length}</td>
                <td className="num">{Math.min(...rows.map((r) => r.score))}</td>
                <td className="num">{Math.max(...rows.map((r) => r.score))}</td>
                <td className="num avgcell">{overall}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <h2 className="section-title">{t("student.bySubject")}</h2>
      {courses.map((list) => (
        <section key={list[0].courseId} id={`course-${list[0].courseId}`} className="card stack">
          <div className="row between">
            <div>
              <h2>{list[0].courseName}</h2>
              <p className="muted">
                {list[0].teacherName} · {list[0].semester}
              </p>
            </div>
            <p className="avg">
              {t("student.average")} <b>{average(list.map((r) => r.score))}</b>
            </p>
          </div>
          <div className="course-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("student.assessment")}</th>
                    <th>{t("student.date")}</th>
                    <th className="num">{t("student.score")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.gradeId}>
                      <td>{r.assessmentName}</td>
                      <td className="muted">{r.gradeDate}</td>
                      <td className={"num" + (isLow(r.score) ? " low" : "")}>
                        {r.score}
                        {isLow(r.score) && <span className="tag">{t("student.tag.below", { mark: PASS_MARK })}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScoreChart
              courseName={list[0].courseName}
              points={list.map((r) => ({ label: r.assessmentName, date: r.gradeDate, score: r.score }))}
            />
          </div>
        </section>
      ))}
    </main>
  );
}
