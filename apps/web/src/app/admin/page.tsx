import { getAdminOverview } from "@gradebook/db";
import { requireRole } from "@/lib/session";
import { enrollAction } from "./actions";

const MESSAGES: Record<string, { text: string; good: boolean }> = {
  enrolled: { text: "Student enrolled. Their teacher can now enter grades for them.", good: true },
  already: { text: "This student is already enrolled in that course.", good: false },
  invalid: { text: "Choose a student and a course.", good: false },
  failed: { text: "Could not enroll the student.", good: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireRole("admin");
  const data = await getAdminOverview(user.id);
  const { status } = await searchParams;
  const message = status ? MESSAGES[status] : undefined;
  const c = data.counts;

  return (
    <main className="page stack">
      <h1>Administration</h1>

      <div className="tiles">
        {(
          [
            ["Students", c.students],
            ["Teachers", c.teachers],
            ["Courses", c.courses],
            ["Enrollments", c.enrollments],
            ["Grades", c.grades],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="card tile">
            <p className="big">{n}</p>
            <p className="muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="card stack">
        <h2>Enroll a student in a course</h2>
        <p className="muted">A teacher can only enter grades for students who are enrolled in their course.</p>
        {message && (
          <p className={message.good ? "success" : "error"} role="status">
            {message.text}
          </p>
        )}
        <form action={enrollAction} className="inline-form">
          <label>
            Student
            <select name="studentId" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {data.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>{s.fullName}</option>
              ))}
            </select>
          </label>
          <label>
            Course
            <select name="courseId" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {data.courses.map((co) => (
                <option key={co.courseId} value={co.courseId}>
                  {co.courseName} ({co.teacherName})
                </option>
              ))}
            </select>
          </label>
          <button className="primary">Enroll</button>
        </form>
      </section>

      <section className="card stack">
        <h2>Courses</h2>
        <table>
          <thead>
            <tr><th>Course</th><th>Teacher</th><th className="num">Students</th></tr>
          </thead>
          <tbody>
            {data.courses.map((co) => (
              <tr key={co.courseId}>
                <td>{co.courseName} <span className="muted small">{co.semester}</span></td>
                <td>{co.teacherName}</td>
                <td className="num">{co.enrolled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <h2>People and roles</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th></tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.email}>
                <td>{p.name}</td>
                <td className="muted">{p.email}</td>
                <td><span className="badge">{p.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
