# Scaling to many concurrent bots

Running 100 bots at once is not a bigger-box problem. It is three separate
problems — isolation, packing density, and join latency — and only the first one
is solved by config alone.

## 1. Isolation: never share the worker process

Attendee's default `LAUNCH_BOT_METHOD` runs every bot inside one Celery worker.
That caps you at a handful of bots no matter what you rent, because the bots
contend for a single process and Celery eventually cannot fork. Every scaling
number below assumes `docker-compose-multi-host` (a container per bot) or
`kubernetes` (a pod per bot). See `docs/DEPLOYMENT.md` for the switch.

## 2. Density: schedule on the request, not the peak

This is where the cost is won or lost.

`BOT_CPU_REQUEST` defaults to `4`. Provision 100 bots that way and you are
buying 400 vCPU — roughly $2,000/month on spot, $10,000 on demand. But 4 cores
is a *peak*: joining a call spikes CPU while Chrome starts, negotiates WebRTC and
renders the Meet UI, then audio-only capture settles far below that. Attendee's
own fixtures already price Meet audio-only at `2`, and a published reference
deployment schedules browser bots at a **0.5 vCPU request with a 2 vCPU limit**.

So the fleet is sized on ~0.5 vCPU/bot and bots burst into the headroom. Joins
are naturally staggered — calls start on :00 and :30, not simultaneously — which
is what makes the overcommit safe. Set the limit, not just the request, so one
wedged bot cannot eat the box.

Working figures per Meet audio-only bot:

| | Value |
| --- | --- |
| CPU request (what you buy) | 0.5 vCPU |
| CPU limit (burst ceiling) | 2 vCPU |
| Memory | 1.5 GB |

Memory comes from measurement: the worker sat at 1.22 GB idle and 3.54 GB with
three bots, so ~0.75 GB/bot plus headroom. **The CPU request is not yet measured
on our workload** — it is Attendee's tuning plus a reference deployment. Measure
it on the first native x86 box and correct this table; local numbers are
worthless because the Mac runs the bot image under emulation.

## 3. What that costs

ap-south-1, Linux, prices fetched from the AWS pricing and spot APIs.

| Shape | vCPU / RAM | Bots @ 0.5 vCPU | On-demand | Spot (cheapest AZ) |
| --- | --- | --- | --- | --- |
| `c7i.2xlarge` | 8 / 16 | ~14 | $0.357/hr | — |
| `m7i.8xlarge` | 32 / 128 | ~64 | $1.697/hr | $0.435/hr |
| `m7i.12xlarge` | 48 / 192 | ~96 | $2.545/hr | $0.583/hr |
| `c7i.12xlarge` | 48 / 96 | ~96 | $2.142/hr | $0.395/hr |

Spot runs 77–82% below on demand here, and bots are the ideal spot workload in
one respect and a bad one in another: they are short-lived and horizontally
redundant, but an interruption mid-call loses that call's recording. Run spot
with capacity-optimized allocation diversified across all three AZs and instance
families, and drain on the two-minute interruption notice by refusing *new*
bots while letting in-flight calls finish.

**100 concurrent bots** needs ~50 vCPU / 150 GB — two `m7i.8xlarge` on spot,
about **$0.87/hr**, which is **~$0.009 per bot-hour**:

| Usage pattern | Monthly |
| --- | --- |
| 100 concurrent, business hours (176 h) | ~$153 |
| 100 concurrent, 24/7 (730 h) | ~$635 |

Fargate is the same order — 0.5 vCPU + 2 GB is $0.031/bot-hour on demand and
roughly $0.009 on Fargate Spot — with no fleet to manage and true scale-to-zero.
Its cost is join latency (below).

The number that actually matters is **cost per bot-hour**, not the instance
price, because bots only exist during calls. 100 meetings/month averaging 45
minutes is 75 bot-hours: under a dollar of compute. Peak concurrency sets the
fleet you must be *able* to reach; usage sets the bill.

## 4. Join latency: why not pure Fargate

A bot has to be in the room before the call gets going. Fargate cold-starts a
task by pulling the image — Attendee's is ~1.8 GB — which puts join at tens of
seconds. Options, in order of effort:

- **EC2 spot ASG with the image baked into the AMI.** Container start is a few
  seconds because nothing is pulled. This is the recommended shape.
- **Warm pool**: keep N idle bot containers pre-started and hand a meeting to
  one. Fastest possible join, at the cost of paying for idle.
- **Fargate + SOCI lazy loading** so the task starts before the image is fully
  pulled. Least infrastructure, still slower than a warm host.

Scheduled meetings hide this entirely — Attendee stages a bot ahead of the start
time, so cold start only hurts ad-hoc "join this call now" dispatch.

## 5. What to run

| Stage | Shape | Concurrent bots |
| --- | --- | --- |
| Now (launch) | one `c7i.2xlarge`, multi-host launcher | ~10 |
| Real traffic | spot ASG, 2–4 hosts, capacity-optimized | 30–60 |
| 100+ | spot ASG across 3 AZs + drain-on-interruption | 100+ |

Nothing in the application changes between these rows. The only edits are
`BOT_MAX_SIMULTANEOUS_BOTS` and how many hosts run the launcher, which is the
point of moving bots out of the worker process in the first place.
