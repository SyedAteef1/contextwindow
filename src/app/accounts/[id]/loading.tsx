import { Page } from "@/components/chrome";
import { CardsSkeleton, HeadSkeleton, Skeleton } from "@/components/skeleton";

/**
 * One account, mid-query.
 *
 * Mirrors the two-column split the real page uses — history on the left, the
 * chat panel sticky on the right — so the chat does not arrive by pushing
 * everything sideways.
 */
export default function LoadingAccount() {
  return (
    <Page current="accounts">
      <Skeleton className="h-3 w-24" />
      <div className="mt-5">
        <HeadSkeleton />
      </div>
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="lg:order-2">
          <div className="rounded-lg border border-rule bg-surface p-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-[70%]" />
            <Skeleton className="mt-6 h-9 w-full" />
          </div>
        </div>
        <div className="lg:order-1">
          <CardsSkeleton count={3} />
        </div>
      </div>
    </Page>
  );
}
