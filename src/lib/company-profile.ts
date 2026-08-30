/**
 * Turning a company's website into something worth retrieving.
 *
 * Scraping gives back marketing prose with the navigation still in it. Stored
 * raw, the first two thousand characters of that became "what we sell" — which
 * on most sites is a cookie notice, a menu, and half a hero headline. It was
 * technically context and practically noise, and it was reaching every brief.
 *
 * So the text is read once by a model and comes back as the handful of things
 * a brief actually needs: what they sell, what it is called, who already buys
 * it, and what they claim as proof. Each lands as its own typed document, so
 * retrieval can surface the pricing paragraph for a pricing question rather
 * than one undifferentiated blob every time.
 */
import { z } from "zod";

import { db } from "@/db";
import { workspaceDocuments, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runStructured } from "@/lib/llm";
import { indexDocument } from "@/lib/retrieval";
import { scrapeCompanySite } from "@/lib/scrape";

const PROFILE_SCHEMA = z.object({
  /** Two or three sentences. The answer to "what does this company do". */
  summary: z.string(),
  /** Named products or capabilities, as the site names them. */
  products: z.array(z.string()).max(12),
  /** Customers the site names. Logos and case studies count; "leading banks" does not. */
  customers: z.array(z.string()).max(20),
  /** Who they appear to sell to, if the site makes it clear. */
  idealCustomer: z.string().nullable(),
  /** Figures, awards, funding, scale — anything a rep could repeat. */
  proofPoints: z.array(z.string()).max(12),
  /** How they say they are different, in their words. */
  positioning: z.string().nullable(),
});

export type CompanyProfile = z.infer<typeof PROFILE_SCHEMA>;

const SYSTEM = [
  "You read a company's own website and record what it says about itself.",
  "Use only what the text states. Never infer, never embellish, never fill a field to be helpful —",
  "an empty list is correct when the site says nothing, and a fabricated customer name is worse",
  "than no customer list because a rep will repeat it on a call.",
  "Ignore navigation, cookie notices, careers copy and legal boilerplate.",
  "Write in the company's own vocabulary, since that is the language their buyers will hear.",
].join(" ");

/** Read the text once and come back with the parts worth keeping. */
export async function understandCompany(input: {
  name: string;
  url: string;
  text: string;
}): Promise<CompanyProfile | null> {
  try {
    return await runStructured({
      schema: PROFILE_SCHEMA,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Website of ${input.name} (${input.url}):\n\n${input.text}`,
        },
      ],
      maxTokens: 2000,
    });
  } catch (error) {
    console.error(`Reading ${input.url} failed:`, error);
    return null;
  }
}

/** One document per kind, so retrieval can answer a pricing question with pricing. */
function documentsFrom(name: string, profile: CompanyProfile) {
  const docs: { title: string; content: string; kind: "product" | "positioning" | "case_study" }[] =
    [];

  if (profile.products.length > 0) {
    docs.push({
      title: `${name} — what we sell`,
      kind: "product",
      content: [profile.summary, "", "Products and capabilities:", ...profile.products.map((p) => `- ${p}`)]
        .join("\n")
        .trim(),
    });
  }

  if (profile.positioning || profile.proofPoints.length > 0) {
    docs.push({
      title: `${name} — how we position it`,
      kind: "positioning",
      content: [
        profile.positioning ?? "",
        profile.proofPoints.length > 0 ? "\nProof points we claim:" : "",
        ...profile.proofPoints.map((p) => `- ${p}`),
      ]
        .join("\n")
        .trim(),
    });
  }

  if (profile.customers.length > 0) {
    docs.push({
      title: `${name} — customers we name publicly`,
      kind: "case_study",
      content: [
        "Customers named on our own website. Safe to reference on a call:",
        ...profile.customers.map((c) => `- ${c}`),
      ].join("\n"),
    });
  }

  return docs.filter((doc) => doc.content.length > 0);
}

export type IngestResult = {
  scraped: boolean;
  understood: boolean;
  documents: number;
  profile: CompanyProfile | null;
};

/**
 * Read a website and file what it says. Used by onboarding and by "re-read".
 *
 * Replaces what a previous read produced rather than adding to it: a site read
 * twice is one company, and two copies of a positioning paragraph both surface
 * in retrieval and disagree with each other the moment the site changes.
 *
 * `idealCustomer` is only ever filled from the site when the rep has not
 * written their own. Theirs is the better answer and must never be overwritten
 * by a guess made from a hero headline.
 */
export async function ingestCompanyWebsite(input: {
  workspaceId: string;
  name: string;
  url: string;
}): Promise<IngestResult> {
  const site = await scrapeCompanySite(input.url);
  if (!site) return { scraped: false, understood: false, documents: 0, profile: null };

  const profile = await understandCompany({ name: input.name, url: site.url, text: site.text });

  // Without a model to read it, the raw text is still better than nothing —
  // it is just filed honestly as raw rather than as a summary.
  if (!profile) {
    const [doc] = await db
      .insert(workspaceDocuments)
      .values({
        workspaceId: input.workspaceId,
        accountId: null,
        title: site.title ?? `${input.name} — website`,
        content: site.text,
        kind: "positioning",
      })
      .returning();
    await safeIndex(input.workspaceId, doc.id, site.text);
    return { scraped: true, understood: false, documents: 1, profile: null };
  }

  await db
    .delete(workspaceDocuments)
    .where(eq(workspaceDocuments.workspaceId, input.workspaceId));

  const docs = documentsFrom(input.name, profile);
  for (const doc of docs) {
    const [saved] = await db
      .insert(workspaceDocuments)
      .values({ workspaceId: input.workspaceId, accountId: null, ...doc })
      .returning();
    await safeIndex(input.workspaceId, saved.id, doc.content);
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, input.workspaceId),
  });

  await db
    .update(workspaces)
    .set({
      description: profile.summary,
      // Never overwrite what a person wrote with what a homepage implied.
      idealCustomer: workspace?.idealCustomer || profile.idealCustomer || null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, input.workspaceId));

  return { scraped: true, understood: true, documents: docs.length, profile };
}

/** Indexing can fail on a missing embedding provider; the document still stands. */
async function safeIndex(workspaceId: string, sourceId: string, content: string) {
  try {
    await indexDocument({
      workspaceId,
      accountId: null,
      sourceType: "workspace_doc",
      sourceId,
      content,
    });
  } catch (error) {
    console.error("Indexing a company document failed:", error);
  }
}
