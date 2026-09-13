import type { Metadata } from "next";
import Home from "../page";

// `/landing` renders the same page as `/` so the two routes can never drift.
export const metadata: Metadata = {
  title: "Context Window — a research brief before every sales call",
  description:
    "Forward a meeting invite and get a one-page brief on the people you're about to sell to, with every claim sourced. Free while we're early.",
  alternates: { canonical: "https://contextwindowhq.com/" },
};

export default function LandingPage() {
  return <Home />;
}
