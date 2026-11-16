import { getGradebook } from "@gradebook/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { GradeGrid } from "./GradeGrid";

export default async function GradebookPage({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await requireRole("teacher");
  const { courseId } = await params;
  const id = Number(courseId);
  if (!Number.isInteger(id)) notFound();

  // The database only returns the course if this teacher teaches it.
  const book = await getGradebook(user.id, id);
  if (!book) notFound();

  return (
    <main className="page stack">
      <div>
        <p className="crumb">
          <Link href="/teacher">← My courses</Link>
        </p>
        <h1>{book.course.courseName}</h1>
        <p className="muted">{book.course.semester}</p>
      </div>
      <GradeGrid
        courseId={book.course.courseId}
        students={book.students}
        assessments={book.assessments}
        scores={book.scores}
      />
    </main>
  );
}
