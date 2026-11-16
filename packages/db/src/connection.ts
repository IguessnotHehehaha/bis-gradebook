/**
 * Turns a database URL into options for the `pg` driver.
 * - Local databases: no SSL.
 * - Hosted databases (Supabase): SSL on. We strip `sslmode` from the URL because the
 *   driver would otherwise override the options below with stricter defaults that fail
 *   on Supabase's certificate chain.
 */
export function pgConnection(url: string): { connectionString: string; ssl: false | { rejectUnauthorized: boolean } } {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("pgbouncer");
  return {
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
  };
}
