import { db } from "./db";

let ensurePromise: Promise<void> | null = null;

export function ensureCampaignOperationalColumns() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(`
        alter table public.campaigns
          add column if not exists boost_status text not null default 'normal',
          add column if not exists boost_status_updated_at timestamptz not null default now()
      `);

      await db.query(`
        update public.campaigns
        set boost_status = 'normal'
        where boost_status is null
          or boost_status not in ('sponsorship', 'high', 'normal', 'low')
      `);

      await db.query(`
        update public.campaigns
        set boost_status = 'normal',
            boost_status_updated_at = now()
        where status = 'pausada'
          and boost_status <> 'normal'
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}
