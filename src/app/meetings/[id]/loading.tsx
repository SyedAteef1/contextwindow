import { Page } from "@/components/chrome";
import { CardsSkeleton, HeadSkeleton, SidebarSkeleton, Skeleton } from "@/components/skeleton";

/**
 * One call, mid-query.
 *
 * The section tabs are drawn as real-width placeholders because they are the
 * first thing a rep reaches for, and a row that appears late shifts everything
 * under it just as they commit to a click.
 */
export default function LoadingMeeting() {
  return (
    <Page current="meetings" sidebar={<SidebarSkeleton />}>
      <Skeleton className="h-3 w-20" />
      <div className="mt-5">
        <HeadSkeleton />
      </div>
      {/* Uneven on purpose: real tab labels are not the same length, and a row
          of identical pills resolves into ragged ones with a visible jolt. */}
      <div className="mb-8 flex flex-wrap gap-2">
        {["w-16", "w-24", "w-14", "w-20", "w-16"].map((w, i) => (
          <Skeleton key={i} className={`h-7 ${w}`} />
        ))}
      </div>
      <CardsSkeleton count={2} />
    </Page>
  );
}
