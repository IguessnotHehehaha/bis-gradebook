import type { Prisma } from "./generated/client";
import { prisma } from "./client";

export type Tx = Prisma.TransactionClient;

/**
 * Runs database work AS a signed-in person.
 *
 * Inside the transaction the connection switches to the low-privilege `authenticated`
 * role and tells PostgreSQL who the person is (the same thing Supabase does for its own
 * API). From then on every query is filtered by the row level security policies, so a
 * student physically cannot read someone else's grades or change a mark, whatever the
 * application code does.
 *
 * Everything inside one call is ONE transaction: if any step fails, all steps roll back.
 */
export async function withUser<T>(userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      select set_config('request.jwt.claim.sub', ${userId}, true),
             set_config('role', 'authenticated', true)
    `;
    return work(tx);
  });
}
