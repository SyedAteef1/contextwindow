// Integrations is now part of the logged-in app — gated to approved users.
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { IntegrationsView } from "@/components/integrations-view";
import { getIdentityByPrincipal } from "@/lib/auth/approval";
import { getSessionPrincipal } from "@/lib/auth/session";

export default async function IntegrationsPage() {
  const principal = await getSessionPrincipal();
  if (!principal) redirect("/login");
  const id = await getIdentityByPrincipal(principal);
  if (!id) redirect("/login");
  if (id.status !== "approved") redirect("/pending");

  return (
    <>
      <AppNav active="integrations" />
      <div className="pt-16">
        <IntegrationsView />
      </div>
    </>
  );
}
