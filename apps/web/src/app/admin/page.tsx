import { getAdminOverview } from "@gradebook/db";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { requireRole } from "@/lib/session";
import { createCourseAction, createStudentAction, createTeacherAction, enrollAction } from "./actions";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { StudentDirectory } from "./StudentDirectory";

const MESSAGES: Record<string, { key: MessageKey; good: boolean }> = {
  enrolled: { key: "admin.msg.enrolled", good: true },
  created: { key: "admin.msg.created", good: true },
  deleted: { key: "admin.msg.deleted", good: true },
  already: { key: "admin.msg.already", good: false },
  invalid: { key: "admin.msg.invalid", good: false },
  duplicate: { key: "admin.msg.duplicate", good: false },
  "self-delete": { key: "admin.msg.selfDelete", good: false },
  "last-admin": { key: "admin.msg.lastAdmin", good: false },
  "has-history": { key: "admin.msg.hasHistory", good: false },
  "auth-delete-failed": { key: "admin.msg.authDeleteFailed", good: false },
  "rate-limited": { key: "admin.msg.rateLimited", good: false },
  failed: { key: "admin.msg.failed", good: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; mins?: string }> }) {
  const user = await requireRole("admin");
  const data = await getAdminOverview(user.id);
  const { status, mins } = await searchParams;
  const { t } = await getT();
  const message = status ? MESSAGES[status] : undefined;
  const c = data.counts;

  return (
    <main className="page stack">
      <h1>{t("admin.title")}</h1>

      <div className="tiles">
        {(
          [
            [t("admin.tile.students"), c.students],
            [t("admin.tile.teachers"), c.teachers],
            [t("admin.tile.courses"), c.courses],
            [t("admin.tile.enrollments"), c.enrollments],
            [t("admin.tile.grades"), c.grades],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="card tile">
            <p className="big">{n}</p>
            <p className="muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="card stack">
        <h2>{t("admin.enroll.title")}</h2>
        <p className="muted">{t("admin.enroll.hint")}</p>
        {message && (
          <p className={message.good ? "success" : "error"} role="status">
            {t(message.key, { mins: Number(mins) || 1 })}
          </p>
        )}
        <form action={enrollAction} className="inline-form">
          <label>
            {t("admin.enroll.student")}
            <select name="studentId" required defaultValue="">
              <option value="" disabled>{t("common.choose")}</option>
              {data.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>{s.fullName}</option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.enroll.course")}
            <select name="courseId" required defaultValue="">
              <option value="" disabled>{t("common.choose")}</option>
              {data.courses.map((co) => (
                <option key={co.courseId} value={co.courseId}>
                  {co.courseName} ({co.teacherName})
                </option>
              ))}
            </select>
          </label>
          <button className="primary">{t("admin.enroll.submit")}</button>
        </form>
      </section>

      <section className="card stack">
        <h2>{t("admin.addStudent.title")}</h2>
        <p className="muted">{t("admin.addStudent.hint")}</p>
        <form action={createStudentAction} className="inline-form">
          <label>{t("admin.field.fullName")}<input name="name" required maxLength={120} /></label>
          <label>{t("admin.field.email")}<input name="email" type="email" required /></label>
          <label>{t("admin.field.password")}<input name="password" type="password" minLength={8} required /></label>
          <label>{t("admin.field.group")}<select name="groupId" required defaultValue=""><option value="" disabled>{t("common.choose")}</option>{data.groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}</select></label>
          <button className="primary">{t("admin.addStudent.submit")}</button>
        </form>
      </section>

      <section className="card stack">
        <h2>{t("admin.addTeacher.title")}</h2>
        <p className="muted">{t("admin.addTeacher.hint")}</p>
        <form action={createTeacherAction} className="inline-form">
          <label>{t("admin.field.fullName")}<input name="name" required maxLength={120} /></label>
          <label>{t("admin.field.email")}<input name="email" type="email" required /></label>
          <label>{t("admin.field.department")}<input name="department" required maxLength={120} /></label>
          <label>{t("admin.field.password")}<input name="password" type="password" minLength={8} required /></label>
          <button className="primary">{t("admin.addTeacher.submit")}</button>
        </form>
      </section>

      <section className="card stack">
        <h2>{t("admin.addCourse.title")}</h2>
        <form action={createCourseAction} className="inline-form">
          <label>{t("admin.field.courseName")}<input name="courseName" required maxLength={120} /></label>
          <label>{t("admin.field.semester")}<input name="semester" required maxLength={80} placeholder={t("admin.field.semesterPlaceholder")} /></label>
          <label>{t("admin.field.teacher")}<select name="teacherId" required defaultValue=""><option value="" disabled>{t("common.choose")}</option>{data.teachers.map((t) => <option key={t.teacherId} value={t.teacherId}>{t.fullName}</option>)}</select></label>
          <button className="primary">{t("admin.addCourse.submit")}</button>
        </form>
      </section>

      <section className="card stack">
        <h2>{t("admin.courses.title")}</h2>
        <table>
          <thead>
            <tr><th>{t("admin.courses.course")}</th><th>{t("admin.courses.teacher")}</th><th className="num">{t("admin.courses.students")}</th></tr>
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
        <h2>{t("admin.students.title")}</h2>
        <StudentDirectory students={data.students} />
      </section>

      <section className="card stack">
        <h2>{t("admin.grades.title")}</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("admin.grades.student")}</th><th>{t("admin.grades.course")}</th><th>{t("admin.grades.assessment")}</th><th className="num">{t("admin.grades.score")}</th><th>{t("admin.grades.date")}</th></tr></thead>
            <tbody>{data.grades.map((g) => <tr key={g.gradeId}><td>{g.studentName}</td><td>{g.courseName}</td><td>{g.assessmentName}</td><td className="num">{g.score}</td><td>{g.gradeDate}</td></tr>)}</tbody>
          </table>
          {data.grades.length === 0 && <p className="muted">{t("admin.grades.empty")}</p>}
        </div>
      </section>

      <section className="card stack">
        <h2>{t("admin.people.title")}</h2>
        <table>
          <thead>
            <tr><th>{t("admin.people.name")}</th><th>{t("admin.people.email")}</th><th>{t("admin.people.role")}</th><th>{t("admin.people.action")}</th></tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">{p.email}</td>
                <td><span className="badge">{t(`role.${p.role}` as MessageKey)}</span></td>
                <td><DeleteAccountForm userId={p.id} email={p.email} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
