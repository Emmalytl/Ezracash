import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db";
import { ensureSecuritySchema } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const u = await requireUser();
    await ensureSecuritySchema();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "user_action").slice(0, 100);
    const details = String(body.details || "").slice(0, 500);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const sql = sqlClient();
    await sql`
      INSERT INTO security_audit(action, admin_id, session_id, ip_address, user_agent, details)
      VALUES(${action}, ${u.id}, ${u.sessionId}, ${ip}, ${userAgent}, ${details})
    `;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Could not record activity." },
      { status: e.message === "UNAUTHORIZED" ? 401 : 500 }
    );
  }
}
