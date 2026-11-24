import { getAttestations, getStudentCourseCatalogue } from "@gradebook/db";
import { getT } from "@/lib/i18n/server";

export async function AttestationResults({ userId }: { userId: string }) {
  const { t } = await getT();
  // One after the other: each call opens its own transaction, and two at once can starve the connection pool.
  const courses = await getStudentCourseCatalogue(userId);
  const results = await getAttestations(userId);
  const own = courses.filter((c) => c.enrolled);
  return (
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
  );
}
