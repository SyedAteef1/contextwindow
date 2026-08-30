import { Page } from "@/components/chrome";
import { HeadSkeleton, RailSkeleton, SidebarSkeleton } from "@/components/skeleton";

/** The dashboard, mid-query. Same chrome, same rail, nothing moves when it lands. */
export default function LoadingMeetings() {
  return (
    <Page current="meetings" sidebar={<SidebarSkeleton />}>
      <HeadSkeleton />
      <RailSkeleton rows={5} />
    </Page>
  );
}
