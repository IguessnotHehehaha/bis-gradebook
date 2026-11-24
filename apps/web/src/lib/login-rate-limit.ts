import { headers } from "next/headers";

export async function authRateLimitKey(action: "signin" | "dev-signin" | "signup") {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "unknown";
  return `${action}:${ip}`;
}
