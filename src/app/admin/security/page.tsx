import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import SecurityDashboard from "./ui";
export const dynamic = "force-dynamic";
export default async function Page() {
 const user = await getAdminUser();
 if (!user) redirect("/admin");
 if (user.role !== "developer") redirect(user.role === "administrator" ? "/admin/administrator" : "/admin/staff/dashboard");
 return <SecurityDashboard/>;
}
