/**
 * Which workspace an account's material belongs to.
 *
 * Every account should carry a workspace from the moment calendar sync creates
 * it, but two cases leave the column empty: rows that predate workspaces, and
 * a rep who somehow has no workspace of their own. Both would otherwise fail
 * an insert at indexing time — after the brief or summary is already saved —
 * so this resolves the workspace from the owner and repairs the account on the
 * way past. Repairing here rather than in a migration means an account fixes
 * itself the first time it is used, whatever created it.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, users, workspaces } from "@/db/schema";
import { isConsumerDomain } from "@/lib/google/calendar";

export async function workspaceIdForAccount(accountId: string): Promise<string> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) throw new Error(`No account ${accountId}`);
  if (account.workspaceId) return account.workspaceId;

  const owner = await db.query.users.findFirst({ where: eq(users.id, account.ownerUserId) });
  if (!owner) throw new Error(`Account ${accountId} has no owner`);

  let workspaceId = owner.workspaceId;
  if (!workspaceId) {
    // Same derivation as sign-in: colleagues share a workspace by email domain,
    // and consumer addresses get one each so every gmail user is not pooled.
    const domain = isConsumerDomain(owner.emailDomain) ? owner.email : owner.emailDomain;
    const [workspace] = await db
      .insert(workspaces)
      .values({ domain, name: domain.split(".")[0].replace(/^./, (c) => c.toUpperCase()) })
      .onConflictDoUpdate({ target: workspaces.domain, set: { updatedAt: new Date() } })
      .returning();
    workspaceId = workspace.id;
    await db.update(users).set({ workspaceId }).where(eq(users.id, owner.id));
  }

  await db.update(accounts).set({ workspaceId }).where(eq(accounts.id, account.id));
  return workspaceId;
}
