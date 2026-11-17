import { getTeacherCourses } from "@gradebook/db";
import { PASS_MARK } from "@gradebook/shared";
import Link from "next/link";
import { requireRole } from "@/lib/session";

export default async function TeacherHome() {
  const user = await requireRole("teacher");
  const courses = await getTeacherCourses(user.id, user.teacherId!);

  const totalGrades = courses.reduce((n, c) => n + c.gradeCount, 0);
  const totalLow = courses.reduce((n, c) => n + c.lowCount, 0);
  const totalStudents = courses.reduce((n, c) => n + c.studentCount, 0);

  return (
    <main className="page stack">
      <div>
        <h1>My courses</h1>
        <p className="muted">Choose a course to open its gradebook.</p>
      </div>

      {courses.length > 0 && (
        <div className="tiles">
          <div className="card tile"><p className="big">{courses.length}</p><p className="muted">Courses</p></div>
          <div className="card tile"><p className="big">{totalStudents}</p><p className="muted">Enrollments</p></div>
          <div className="card tile"><p className="big">{totalGrades}</p><p className="muted">Grades entered</p></div>
          <div className="card tile">
            <p className={"big" + (totalLow ? " low" : "")}>{totalLow}</p>
            <p className="muted">Below {PASS_MARK}</p>
          </div>
        </div>
      )}

      {courses.length === 0 && <p className="card">You are not assigned to any course yet.</p>}
      <div className="cards">
        {courses.map((c) => (
          <Link key={c.courseId} href={`/teacher/${c.courseId}`} className="card course-card">
            <div className="row between">
              <h2>{c.courseName}</h2>
              <span className="badge">{c.semester}</span>
            </div>
            <p className="muted">
              {c.studentCount} students · {c.assessmentCount} assessments · {c.gradeCount} grades
            </p>
            <div className="course-stats">
              <div>
                <p className="big-sm">{c.average ?? "–"}</p>
                <p className="muted small">Average</p>
              </div>
              <div>
                <p className={"big-sm" + (c.lowCount ? " low" : "")}>{c.lowCount}</p>
                <p className="muted small">Below {PASS_MARK}</p>
              </div>
            </div>
            <p className="open-link">Open gradebook →</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
