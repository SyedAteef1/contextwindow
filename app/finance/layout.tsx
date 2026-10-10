import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Context Window Finance — CIM to Excel Operating Model for Searchers",
  description:
    "For US solo search fund operators: send a scanned PDF CIM and the IRS Form 1120-S, get back a 4-tab Excel operating model. $250 per deal, no subscription.",
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children
}
