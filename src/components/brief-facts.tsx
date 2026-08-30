import { cn } from "@/lib/cn";

/**
 * The top of the brief: what a rep would otherwise hunt for.
 *
 * Someone opening this two minutes before a call reads the first screen and
 * nothing else. Underneath is a good brief — genuinely worth reading, and worth
 * reading in prose, because "builder-stage buyer: fast, technical, founder-led"
 * is a judgement that does not survive being cut into fields. But it opened as
 * a wall of paragraphs, and a wall answers nothing in three seconds.
 *
 * So the facts are lifted to the front and set in a grid: label above value,
 * mono label, tabular value. Nothing here is new information — every line is
 * already in the paragraphs below, already cited. It is the same brief, read in
 * the order a rep actually reads it.
 */
export function BriefFacts({ facts }: { facts: { label: string; value: string }[] }) {
  if (facts.length === 0) return null;

  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-5 border-b border-rule-soft px-6 py-5",
        // Two up on a phone, then as many as there are. A fixed four-column
        // grid leaves a ragged empty cell when the model finds only three.
        "grid-cols-2",
        facts.length >= 3 && "sm:grid-cols-3",
        facts.length >= 4 && "lg:grid-cols-4",
      )}
    >
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            {fact.label}
          </dt>
          <dd className="mt-1.5 text-[13.5px] font-medium leading-snug text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
