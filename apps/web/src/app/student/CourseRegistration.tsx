import { getAttestations, getStudentCourseCatalogue } from "@gradebook/db";
import { getT } from "@/lib/i18n/server";
import { selfEnrollAction } from "./actions";

export async function CourseRegistration({ userId, status }: { userId: string; status?: string }) {
  const { t } = await getT();
  const [courses, results] = await Promise.all([getStudentCourseCatalogue(userId), getAttestations(userId)]);
  const own = courses.filter((c) => c.enrolled);
  const notices = {
    enrolled: t("feature.enrollSuccess"), already: t("feature.already"), failed: t("feature.enrollFailed"),
  };
  const notice = status && Object.hasOwn(notices, status) ? notices[status as keyof typeof notices] : null;
  return <>
    <section className="card stack">
      <h2>{t("feature.catalogue")}</h2>
      {notice && <p role="status" className={status === "enrolled" ? "success" : "notice"}>{notice}</p>}
      {courses.length === 0 ? <p className="muted">{t("feature.noCourses")}</p> :
        <div className="table-wrap"><table>
          <thead><tr><th>{t("student.summary.subject")}</th><th>{t("student.summary.teacher")}</th><th>{t("student.summary.status")}</th></tr></thead>
          <tbody>{courses.map((c) => <tr key={c.courseId}>
            <td>{c.courseName}<span className="muted small block">{c.semester}</span></td><td>{c.teacherName}</td>
            <td>{c.enrolled ? <span className="badge">{t("feature.enrolled")}</span> :
              <form action={selfEnrollAction}><input type="hidden" name="courseId" value={c.courseId} /><button className="primary" type="submit">{t("feature.enroll")}</button></form>}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    <section className="card stack">
      <h2>{t("feature.attestations")}</h2><p className="muted">{t("feature.rule")}</p>
      {own.length === 0 ? <p className="muted">{t("feature.noEnrollments")}</p> :
        <div className="table-wrap"><table>
          <thead><tr><th>{t("student.summary.subject")}</th><th className="num">{t("feature.first")}</th><th className="num">{t("feature.second")}</th><th className="num">{t("feature.average")}</th></tr></thead>
          <tbody>{own.map((c) => {
            const result = results.find((a) => a.courseId === c.courseId);
            return <tr key={c.courseId}><td>{c.courseName}<span className="muted small block">{c.semester}</span></td>
              <td className="num">{result?.first ?? "—"}</td><td className="num">{result?.second ?? "—"}</td><td className="num avgcell">{result?.average ?? "—"}</td></tr>;
          })}</tbody>
        </table></div>}
    </section>
  </>;
}
