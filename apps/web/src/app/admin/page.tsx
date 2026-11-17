import { getAdminOverview } from "@gradebook/db";
import { requireRole } from "@/lib/session";
import { createCourseAction, createStudentAction, createTeacherAction, enrollAction } from "./actions";
import { DeleteAccountForm } from "./DeleteAccountForm";

const MESSAGES: Record<string, { text: string; good: boolean }> = {
  enrolled: { text: "Student enrolled. Their teacher can now enter grades for them.", good: true },
  created: { text: "New record and account created successfully.", good: true },
  deleted: { text: "User account deleted. Academic records are retained.", good: true },
  already: { text: "This student is already enrolled in that course.", good: false },
  invalid: { text: "Check the submitted fields and try again.", good: false },
  duplicate: { text: "An account with that email already exists.", good: false },
  "self-delete": { text: "You cannot delete your own account.", good: false },
  "last-admin": { text: "The last administrator cannot be deleted.", good: false },
  "has-history": { text: "This account appears in the grade change history and cannot be deleted.", good: false },
  "auth-delete-failed": { text: "The app profile was removed, but Supabase could not delete the login. Check the Auth service settings.", good: false },
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
        <h2>Add a student</h2>
        <p className="muted">Creates a student profile and sign-in account. Set an initial password of at least 8 characters.</p>
        <form action={createStudentAction} className="inline-form">
          <label>Full name<input name="name" required maxLength={120} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Initial password<input name="password" type="password" minLength={8} required /></label>
          <label>Group<select name="groupId" required defaultValue=""><option value="" disabled>Choose…</option>{data.groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></label>
          <button className="primary">Add student</button>
        </form>
      </section>

      <section className="card stack">
        <h2>Add a teacher</h2>
        <p className="muted">Creates a teacher profile and sign-in account.</p>
        <form action={createTeacherAction} className="inline-form">
          <label>Full name<input name="name" required maxLength={120} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Department<input name="department" required maxLength={120} /></label>
          <label>Initial password<input name="password" type="password" minLength={8} required /></label>
          <button className="primary">Add teacher</button>
        </form>
      </section>

      <section className="card stack">
        <h2>Add a course</h2>
        <form action={createCourseAction} className="inline-form">
          <label>Course name<input name="courseName" required maxLength={120} /></label>
          <label>Semester<input name="semester" required maxLength={80} placeholder="Fall 2026" /></label>
          <label>Teacher<select name="teacherId" required defaultValue=""><option value="" disabled>Choose…</option>{data.teachers.map((t) => <option key={t.teacherId} value={t.teacherId}>{t.fullName}</option>)}</select></label>
          <button className="primary">Add course</button>
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
        <h2>All students</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Group</th></tr></thead>
            <tbody>{data.students.map((s) => <tr key={s.studentId}><td>{s.studentId}</td><td>{s.fullName}</td><td className="muted">{s.email}</td><td>{s.groupName}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>All grades</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Assessment</th><th className="num">Score</th><th>Date</th></tr></thead>
            <tbody>{data.grades.map((g) => <tr key={g.gradeId}><td>{g.studentName}</td><td>{g.courseName}</td><td>{g.assessmentName}</td><td className="num">{g.score}</td><td>{g.gradeDate}</td></tr>)}</tbody>
          </table>
          {data.grades.length === 0 && <p className="muted">No grades have been entered yet.</p>}
        </div>
      </section>

      <section className="card stack">
        <h2>People and roles</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">{p.email}</td>
                <td><span className="badge">{p.role}</span></td>
                <td><DeleteAccountForm userId={p.id} email={p.email} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
