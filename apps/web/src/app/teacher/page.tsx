import { getTeacherCourses } from "@gradebook/db";
import { PASS_MARK } from "@gradebook/shared";
import Link from "next/link";
import { requireRole } from "@/lib/session";

export default async function TeacherHome() {
  const user = await requireRole("teacher");
  const courses = await getTeacherCourses(user.id, user.teacherId!);

  return (
    <main className="page stack">
      <div>
        <h1>My courses</h1>
        <p className="muted">Choose a course to open its gradebook.</p>
      </div>
      {courses.length === 0 && <p className="card">You are not assigned to any course yet.</p>}
      <div className="cards">
        {courses.map((c) => (
          <Link key={c.courseId} href={`/teacher/${c.courseId}`} className="card course-card">
            <h2>{c.courseName}</h2>
            <p className="muted">{c.semester}</p>
            <p>
              {c.studentCount} students · {c.gradeCount} grades
            </p>
            {c.lowCount > 0 ? (
              <p className="low-text">
                {c.lowCount} results below {PASS_MARK}
              </p>
            ) : (
              <p className="muted">No results below {PASS_MARK}</p>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
