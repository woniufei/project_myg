import { redirect } from "next/navigation";
import { userHasRole } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

/**
 * Root entry. Admin lands in governance; all execution roles land in My Work.
 */
export default async function Home() {
  const { currentUser } = await getShellRequestContext();
  redirect(currentUser && userHasRole(currentUser, "admin") ? "/admin" : "/my/page");
}
