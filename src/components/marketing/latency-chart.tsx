/**
 * Answer latency, measured.
 *
 * The block this replaces charted a product against named competitors with
 * invented percentages. Fabricated claims about named rivals are dishonest and
 * legally exposed, so this charts something real: the three paths an answer can
 * take, timed on the deployed stack.
 *
 * Shorter is better, which inverts the usual bar chart and is the whole point —
 * the prepared answer is a sliver beside the alternatives.
 *
 * No motion library and no animated counter: both would server-render the bars
 * invisible and wait for JavaScript, and a chart that needs a bundle to be
 * legible is worse than one that simply draws.
 */
const SCALE_MS = 1500;

const BARS = [
  { value: 5, label: "Prepared answer", note: "Written the day before", accent: true },
  { value: 412, label: "Generated live", note: "Not anticipated, written now" },
  { value: 1500, label: "Without the cache", note: "Every answer from scratch" },
];

export function LatencyChart() {
  return (
    <section className="border-t border-white/10 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-16">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Measured, not claimed
            </p>
            <h2 className="text-4xl font-semibold leading-tight tracking-tighter text-white sm:text-5xl">
              The answer arrives before the sentence ends.
            </h2>
            <p className="text-base leading-relaxed text-zinc-400">
              Transcription alone takes 700 to 1,050ms on Google Meet. A prepared answer is on
              screen inside five — waiting before the question has finished being asked.
            </p>
          </div>

          <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-end gap-6 sm:gap-8">
            {BARS.map((bar, index) => {
              // Square-rooted so 5ms stays visible beside 1,500ms. The caption
              // says so, and the real number is printed above every bar.
              const height = Math.max(3, Math.sqrt(bar.value / SCALE_MS) * 100);
              return (
                <div key={bar.label} className="flex flex-col items-center gap-3">
                  <p className="flex items-baseline gap-1">
                    <span
                      className={`font-mono text-xl font-medium tabular-nums sm:text-2xl ${
                        bar.accent ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      {bar.value.toLocaleString("en-GB")}
                    </span>
                    <span className="font-mono text-xs text-zinc-600">ms</span>
                  </p>

                  {/* A baseline the bars stand on: without it short bars float
                      and the whole thing stops reading as a chart. */}
                  <div className="flex h-56 w-full items-end border-b border-white/15 sm:h-64">
                    <div
                      className={`grow-y w-full rounded-t ${
                        bar.accent
                          ? "bg-amber-400/90"
                          : "bg-zinc-800"
                      }`}
                      style={{ height: `${height}%`, animationDelay: `${index * 0.1}s` }}
                    />
                  </div>

                  <div className="flex w-full flex-col gap-1 border-t border-dashed border-white/10 pt-3 text-center">
                    <p
                      className={`text-sm font-medium ${
                        bar.accent ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      {bar.label}
                    </p>
                    <p className="text-xs leading-relaxed text-zinc-600">{bar.note}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-zinc-600">
            Timed on the deployed stack. Bar heights are square-rooted so the smallest stays
            visible — the numbers above them are the measurement.
          </p>
        </div>
      </div>
    </section>
  );
}
