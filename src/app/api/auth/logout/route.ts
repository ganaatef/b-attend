/**
 * POST /api/auth/logout — destroys session and returns 200.
 */
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
