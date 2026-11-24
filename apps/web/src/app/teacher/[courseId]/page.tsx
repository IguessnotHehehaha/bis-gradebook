import { getAttestations, getGradebook } from "@gradebook/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";
import { AttestationGrid } from "./AttestationGrid";
import { GradeGrid } from "./GradeGrid";

export default async function GradebookPage({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await requireRole("teacher");
  const { t, plural } = await getT();
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isInteger(id)) notFound();

  // The database only returns the course if this teacher teaches it.
  const book = await getGradebook(user.id, id);
  if (!book) notFound();
  const attestations = await getAttestations(user.id, id);

  return (
    <main className="page stack">
      <div>
        <p className="crumb">
          <Link href="/teacher">{t("teacher.back")}</Link>
        </p>
        <h1>{book.course.courseName}</h1>
        <p className="muted">{book.course.semester} · {plural("count.enrolled", book.students.length)}</p>
      </div>
      <AttestationGrid courseId={id} students={book.students} initial={attestations} />
      <GradeGrid
        courseId={book.course.courseId}
        students={book.students}
        assessments={book.assessments}
        scores={book.scores}
      />
    </main>
  );
}
