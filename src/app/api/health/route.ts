import { NextResponse } from "next/server";
import { getDatabaseEnvStatus } from "@/lib/db";

export async function GET() {
  const environment = getDatabaseEnvStatus();
  return NextResponse.json({
    ok: true,
    publicLandingPage: "/",
    adminLogin: "/admin",
    adminDashboard: "/admin",
    databaseConfigured: Object.values(environment).some(Boolean),
    environment
  });
}
