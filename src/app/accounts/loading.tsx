import { Page } from "@/components/chrome";
import { CardsSkeleton, HeadSkeleton } from "@/components/skeleton";

export default function LoadingAccounts() {
  return (
    <Page current="accounts">
      <HeadSkeleton />
      <CardsSkeleton count={4} />
    </Page>
  );
}
