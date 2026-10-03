@AGENTS.md

# TextNext (multi-university)

- Tenancy: every member belongs to one university derived from their verified email (`private.match_university` / `resolve_or_create_university`). All member data is scoped by `university_id` through RLS — never add a query path that skips it.
- Trades change state only through the RPCs in `supabase/migrations/20261003000006_trades.sql`; clients have no UPDATE grant on `trades`. System messages carry `event` + `payload` and are rendered as cards (`components/trade/message-list.tsx`).
- Database functions raise short error codes (`raise exception 'item_reserved'`); add a Japanese message for any new code in `lib/errors.ts`.
- After changing SQL: `npm run db:reset && npm run db:types && npm run db:test`. Local Supabase runs on ports 563xx (`supabase/config.toml`).
- Production (`exaczkuxpjmvwgtpdwlo`, linked) has every migration applied: never edit an existing migration file — add a new one.
- Test data: `npm run db:seed` creates テスト大学 (`*@test-univ.ac.jp`), サンプル大学 and `admin@example.com`, all with password `test1234` (fixtures in `scripts/seed/`); `-- --remove` deletes it. `npm run db:seed:remote` does the same on production from `.env.remote.local` (password `SEED_PASSWORD`, no admin account). It goes through the real RPCs, so update it when an RPC signature changes.
- UI text is Japanese. Use the semantic Tailwind tokens from `app/globals.css` (`bg-surface`, `text-muted`, …) so dark mode keeps working.
