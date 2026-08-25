/**
 * Server-sent events carrying live answers to the rep's browser.
 *
 * SSE rather than WebSockets: this is one-way, and SSE reconnects by itself
 * over plain HTTP with no extra server.
 */
import { handler, requireOwnedMeeting, requireUser } from "@/lib/api";
import { listLiveAnswers } from "@/agents/live";
import { subscribeLiveAnswers } from "@/lib/live-bus";

// Held open for the length of a call.
export const maxDuration = 3600;

export const GET = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    const meeting = await requireOwnedMeeting(user.id, id);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // Replay what already exists, so a refresh mid-call doesn't lose history.
        send("backlog", await listLiveAnswers(meeting.id));

        const unsubscribe = await subscribeLiveAnswers(meeting.id, (payload) => {
          send("answer", payload);
        });

        // Proxies drop an idle connection; a comment line keeps it warm
        // without being delivered as an event.
        const keepAlive = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }, 25_000);

        const close = async () => {
          if (closed) return;
          closed = true;
          clearInterval(keepAlive);
          await unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        };

        request.signal.addEventListener("abort", () => void close());
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
