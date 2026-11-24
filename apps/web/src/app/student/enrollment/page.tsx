import { getT } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";
import { CourseRegistration } from "../CourseRegistration";

export default async function EnrollmentPage({ searchParams }: { searchParams: Promise<{ enrollment?: string }> }) {
  const { enrollment } = await searchParams;
  const user = await requireRole("student");
  const { t } = await getT();
  return (
    <main className="page stack">
      <div>
        <h1>{t("nav.enrollment")}</h1>
        <p className="muted">{t("home.enrollment.desc")}</p>
      </div>
      <CourseRegistration userId={user.id} status={enrollment} />
    </main>
  );
}
