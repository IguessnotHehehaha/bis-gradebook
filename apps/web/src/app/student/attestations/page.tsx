import { getT } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";
import { AttestationResults } from "../AttestationResults";

export default async function AttestationsPage() {
  const user = await requireRole("student");
  const { t } = await getT();
  return (
    <main className="page stack">
      <div>
        <h1>{t("nav.attestations")}</h1>
        <p className="muted">{t("home.attestations.desc")}</p>
      </div>
      <AttestationResults userId={user.id} />
    </main>
  );
}
