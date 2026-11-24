import Form from "next/form";
import Link from "next/link";
import { getAdminAccounts, getAdminCounts, getAdminCourses, getAdminGrades, getAdminStudents } from "@gradebook/db";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { requireRole } from "@/lib/session";
import { createCourseAction, createStudentAction, createTeacherAction, enrollAction } from "./actions";
import { AdminPagination } from "./AdminPagination";
import { DeleteAccountForm } from "./DeleteAccountForm";

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

const views = ["overview", "students", "courses", "grades", "accounts"] as const;
type View = typeof views[number];
type Search = Record<string, string | string[] | undefined>;

function first(value: Search[string]) {
  return typeof value === "string" ? value : undefined;
}

function idOf(value: Search[string]) {
  const id = Number(first(value));
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : undefined;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, params, { t }] = await Promise.all([requireRole("admin"), searchParams, getT()]);
  const requestedView = first(params.view);
  const view = views.find((item) => item === requestedView) ?? (params.gradePage ? "grades" : "overview");
  const status = first(params.status);
  const message = status ? MESSAGES[status] : undefined;
  const page = Number(first(params.page) ?? first(params.gradePage));

  return (
    <main className="page stack">
      <header className="grid gap-3">
        <h1>{t("admin.title")}</h1>
        <nav className="flex flex-wrap gap-1" aria-label={t("admin.sections")}>
          {views.map((item) => (
            <Link
              key={item}
              href={item === "overview" ? "/admin" : `/admin?view=${item}`}
              prefetch={false}
              aria-current={view === item ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted-foreground no-underline hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
            >
              {t(`admin.section.${item}`)}
            </Link>
          ))}
        </nav>
      </header>

      {message && <p className={message.good ? "success" : "error"} role="status">
        {t(message.key, { mins: Number(first(params.mins)) || 1 })}
      </p>}
      <AdminView view={view} userId={user.id} params={params} page={page} />
    </main>
  );
}

function AdminView({ view, userId, params, page }: { view: View; userId: string; params: Search; page: number }) {
  switch (view) {
    case "students": return <StudentsView userId={userId} params={params} page={page} />;
    case "courses": return <CoursesView userId={userId} />;
    case "grades": return <GradesView userId={userId} page={page} studentId={idOf(params.studentId)} />;
    case "accounts": return <AccountsView userId={userId} page={page} />;
    case "overview": return <Overview userId={userId} />;
  }
}

async function Overview({ userId }: { userId: string }) {
  const [counts, { t }] = await Promise.all([getAdminCounts(userId), getT()]);
  return (
    <section className="card grid gap-4">
      <h2>{t("admin.section.overview")}</h2>
      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-5">
        {(["students", "teachers", "courses", "enrollments", "grades"] as const).map((name) => (
          <div key={name}>
            <dt className="muted small">{t(`admin.tile.${name}`)}</dt>
            <dd className="m-0 text-2xl font-semibold tabular-nums">{counts[name]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function StudentsView({ userId, params, page }: { userId: string; params: Search; page: number }) {
  const search = first(params.q)?.trim().slice(0, 100) ?? "";
  const groupId = idOf(params.group);
  const courseId = idOf(params.course);
  const [data, { t }] = await Promise.all([getAdminStudents(userId, { search, groupId, courseId, page }), getT()]);
  const filters = new URLSearchParams({ view: "students" });
  if (search) filters.set("q", search);
  if (groupId) filters.set("group", String(groupId));
  if (courseId) filters.set("course", String(courseId));
  return (
    <>
      <section className="card stack">
        <h2>{t("admin.students.title")}</h2>
        <Form key={filters.toString()} action="/admin" prefetch={false} className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto]">
          <input type="hidden" name="view" value="students" />
          <label className="col-span-2 sm:col-span-1">{t("admin.filters.search")}<input name="q" type="search" maxLength={100} defaultValue={search} /></label>
          <label className="min-w-0">{t("admin.filters.group")}
            <select name="group" defaultValue={groupId ?? ""}>
              <option value="">{t("admin.filters.allGroups")}</option>
              {data.groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}
            </select>
          </label>
          <label className="min-w-0">{t("admin.filters.course")}
            <select name="course" defaultValue={courseId ?? ""}>
              <option value="">{t("admin.filters.allCourses")}</option>
              {data.courses.map((course) => <option key={course.courseId} value={course.courseId}>{course.courseName} · {course.semester}</option>)}
            </select>
          </label>
          <div className="row col-span-2 sm:col-span-1">
            <button className="primary">{t("admin.filters.apply")}</button>
            {(search || groupId || courseId) && <Link href="/admin?view=students">{t("admin.filters.reset")}</Link>}
          </div>
        </Form>
        <p className="muted small">{t("admin.list.total", { total: data.pagination.total })}</p>
        {data.students.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("admin.students.name")}</th><th className="hidden sm:table-cell">{t("admin.students.email")}</th><th>{t("admin.students.group")}</th><th>{t("admin.section.grades")}</th></tr></thead>
              <tbody>{data.students.map((student) => (
                <tr key={student.studentId}>
                  <th scope="row">
                    {student.fullName}
                    <span className="block break-all text-xs font-normal sm:hidden">{student.email}</span>
                  </th>
                  <td className="muted hidden sm:table-cell">{student.email}</td>
                  <td>{student.group.groupName}</td>
                  <td><Link href={`/admin?view=grades&studentId=${student.studentId}`} prefetch={false}>{t("admin.students.viewGrades")}</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">{t("admin.filters.empty")}</p>}
        <AdminPagination {...data.pagination} href={filters.toString()} />
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
    </>
  );
}

async function CoursesView({ userId }: { userId: string }) {
  const [data, { t }] = await Promise.all([getAdminCourses(userId), getT()]);
  return (
    <>
      <section className="card stack">
        <h2>{t("admin.courses.title")}</h2>
        <div className="table-wrap"><table>
          <thead>
            <tr><th>{t("admin.courses.course")}</th><th>{t("admin.courses.teacher")}</th><th className="num">{t("admin.courses.students")}</th></tr>
          </thead>
          <tbody>
            {data.courses.map((co) => (
              <tr key={co.courseId}>
                <td>{co.courseName} <span className="muted small">{co.semester}</span></td>
                <td>{co.teacher.fullName}</td>
                <td className="num">{co._count.enrollments}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
      <section className="card stack">
        <h2>{t("admin.enroll.title")}</h2>
        <p className="muted">{t("admin.enroll.hint")}</p>
        <form action={enrollAction} className="inline-form">
          <label>
            {t("admin.enroll.student")}
            <select name="studentId" required defaultValue="">
              <option value="" disabled>{t("common.choose")}</option>
              {data.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>{s.fullName} ({s.email})</option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.enroll.course")}
            <select name="courseId" required defaultValue="">
              <option value="" disabled>{t("common.choose")}</option>
              {data.courses.map((co) => (
                <option key={co.courseId} value={co.courseId}>
                  {co.courseName} ({co.teacher.fullName})
                </option>
              ))}
            </select>
          </label>
          <button className="primary">{t("admin.enroll.submit")}</button>
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
    </>
  );
}

async function GradesView({ userId, page, studentId }: { userId: string; page: number; studentId?: number }) {
  const [data, { t }] = await Promise.all([getAdminGrades(userId, page, studentId), getT()]);
  const href = studentId === undefined ? "view=grades" : `view=grades&studentId=${studentId}`;
  return (
      <section id="grades" className="card stack">
        <div className="row between flex-wrap">
          <h2>{t(studentId === undefined ? "admin.grades.title" : "admin.grades.studentTitle")}</h2>
          {studentId !== undefined && <Link href="/admin?view=grades">{t("admin.filters.allStudents")}</Link>}
        </div>
        <p className="muted small">{t("admin.list.total", { total: data.pagination.total })}</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("admin.grades.student")}</th><th>{t("admin.grades.course")}</th><th>{t("admin.grades.assessment")}</th><th className="num">{t("admin.grades.score")}</th><th>{t("admin.grades.date")}</th></tr></thead>
            <tbody>{data.grades.map((g) => <tr key={g.gradeId}><td>{g.studentName}</td><td>{g.courseName}</td><td>{g.assessmentName}</td><td className="num">{g.score}</td><td>{g.gradeDate}</td></tr>)}</tbody>
          </table>
          {data.grades.length === 0 && <p className="muted">{t("admin.grades.empty")}</p>}
        </div>
        <AdminPagination {...data.pagination} href={href} />
      </section>
  );
}

async function AccountsView({ userId, page }: { userId: string; page: number }) {
  const [data, { t }] = await Promise.all([getAdminAccounts(userId, page), getT()]);
  return (
    <>
      <section className="card stack">
        <h2>{t("admin.people.title")}</h2>
        <div className="table-wrap"><table>
          <thead>
            <tr><th>{t("admin.people.name")}</th><th>{t("admin.people.email")}</th><th>{t("admin.people.role")}</th><th>{t("admin.people.action")}</th></tr>
          </thead>
          <tbody>
            {data.users.map((p) => (
              <tr key={p.id}>
                <td>{p.name ?? t("role.administrator")}</td>
                <td className="muted">{p.email}</td>
                <td><span className="badge">{t(`role.${p.role}` as MessageKey)}</span></td>
                <td><DeleteAccountForm userId={p.id} email={p.email} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <AdminPagination {...data.pagination} href="view=accounts" />
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
    </>
  );
}
