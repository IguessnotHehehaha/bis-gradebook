import { prisma } from "@gradebook/db";
import type { User } from "@supabase/supabase-js";

export function registrationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= 120 ? name : null;
}

/** Complete registration for accounts created by the previous email-confirmation flow. */
export async function provisionRegisteredStudent(user: User) {
  const name = registrationName(user.user_metadata.gradebook_registration_name);
  const email = user.email?.trim().toLowerCase();
  if (!name || !email || !user.email_confirmed_at) return;
  await createRegisteredStudent({ id: user.id, email, name });
}

export async function createRegisteredStudent({ id, email, name }: { id: string; email: string; name: string }) {
  const existing = await prisma.appUser.findUnique({ where: { id }, select: { id: true } });
  if (existing) return true;

  return prisma.$transaction(async (tx) => {
    // An existing academic profile is never attached to a self-registered login.
    if (await tx.appUser.findUnique({ where: { email }, select: { id: true } })) return false;
    const { groupId } = await tx.studentGroup.upsert({
      where: { groupName: "Unassigned" },
      create: { groupName: "Unassigned" },
      update: { groupName: "Unassigned" },
      select: { groupId: true },
    });
    const result = await tx.student.createMany({
      data: [{ fullName: name, email, groupId }],
      skipDuplicates: true,
    });
    if (result.count === 0) return false;
    const { studentId } = await tx.student.findUniqueOrThrow({ where: { email }, select: { studentId: true } });
    await tx.appUser.create({ data: { id, email, role: "STUDENT", studentId } });
    return true;
  });
}
