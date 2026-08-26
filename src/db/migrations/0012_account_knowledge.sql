-- A workspace document can now belong to one account.
--
-- Null keeps the existing meaning: the seller's own material, in scope for
-- every prospect. Set scopes it to one company, so a rep can file what they
-- know about that customer — procurement rules, the org chart, notes from a
-- site visit — in the same place and have it retrieved the same way.
alter table "workspace_documents"
  add column if not exists "account_id" uuid
  references "accounts"("id") on delete cascade;

create index if not exists "ix_workspace_docs_account"
  on "workspace_documents" ("account_id", "is_active");
