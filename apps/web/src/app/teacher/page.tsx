import { getTeacherCourses } from "@gradebook/db";
import { PASS_MARK } from "@gradebook/shared";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";

export default async function TeacherHome() {
  const user = await requireRole("teacher");
  const { t, plural } = await getT();
  const courses = await getTeacherCourses(user.id, user.teacherId!);

  const totalGrades = courses.reduce((n, c) => n + c.gradeCount, 0);
  const totalLow = courses.reduce((n, c) => n + c.lowCount, 0);
  const totalStudents = courses.reduce((n, c) => n + c.studentCount, 0);

  return (
    <main className="page stack">
      <div>
        <h1>{t("teacher.title")}</h1>
        <p className="muted">{t("teacher.subtitle")}</p>
      </div>

      {courses.length > 0 && (
        <div className="tiles">
          <div className="card tile"><p className="big">{courses.length}</p><p className="muted">{t("teacher.tile.courses")}</p></div>
          <div className="card tile"><p className="big">{totalStudents}</p><p className="muted">{t("teacher.tile.enrollments")}</p></div>
          <div className="card tile"><p className="big">{totalGrades}</p><p className="muted">{t("teacher.tile.grades")}</p></div>
          <div className="card tile">
            <p className={"big" + (totalLow ? " low" : "")}>{totalLow}</p>
            <p className="muted">{t("teacher.tile.below", { mark: PASS_MARK })}</p>
          </div>
        </div>
      )}

      {courses.length === 0 && <p className="card">{t("teacher.none")}</p>}
      <div className="cards">
        {courses.map((c) => (
          <Link key={c.courseId} href={`/teacher/${c.courseId}`} className="card course-card">
            <div className="row between">
              <h2>{c.courseName}</h2>
              <span className="badge">{c.semester}</span>
            </div>
            <p className="muted">
              {plural("count.student", c.studentCount)} · {plural("count.assessment", c.assessmentCount)} · {plural("count.grade", c.gradeCount)}
            </p>
            <div className="course-stats">
              <div>
                <p className="big-sm">{c.average ?? t("common.none")}</p>
                <p className="muted small">{t("teacher.average")}</p>
              </div>
              <div>
                <p className={"big-sm" + (c.lowCount ? " low" : "")}>{c.lowCount}</p>
                <p className="muted small">{t("teacher.tile.below", { mark: PASS_MARK })}</p>
              </div>
            </div>
            <p className="open-link">{t("teacher.open")}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
