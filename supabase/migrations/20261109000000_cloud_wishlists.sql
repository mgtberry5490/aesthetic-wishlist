create extension if not exists pgcrypto with schema extensions;

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.wishlist_items (
  id text primary key,
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  product_url text not null,
  image_url text not null default '',
  notes text not null default '',
  status text not null check (status in ('Thinking about it', 'Still want', 'Bought', 'No longer want')),
  priority smallint check (priority between 1 and 3),
  added_at timestamptz not null
);

create index wishlist_items_wishlist_id_idx on public.wishlist_items (wishlist_id);

create table public.gift_reservations (
  item_id text primary key references public.wishlist_items (id) on delete cascade,
  reserved_at timestamptz not null default now()
);

alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.gift_reservations enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.wishlists, public.wishlist_items to authenticated;
revoke all on public.wishlists, public.wishlist_items from public, anon;
revoke all on public.gift_reservations from public, anon, authenticated;

create policy "Owners can manage their wishlists"
  on public.wishlists
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can manage their wishlist items"
  on public.wishlist_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.wishlists
      where wishlists.id = wishlist_items.wishlist_id
        and wishlists.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.wishlists
      where wishlists.id = wishlist_items.wishlist_id
        and wishlists.owner_id = (select auth.uid())
    )
  );

create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'title', i.title,
          'productUrl', i.product_url,
          'imageUrl', i.image_url,
          'notes', i.notes,
          'status', i.status,
          'priority', i.priority,
          'addedAt', i.added_at,
          'reserved', case
            when (select auth.uid()) = w.owner_id then false
            else r.item_id is not null
          end
        ) order by i.added_at desc
      ) filter (where i.id is not null),
      '[]'::jsonb
    )
  )
  from public.wishlists w
  left join public.wishlist_items i
    on i.wishlist_id = w.id
    and i.status <> 'No longer want'
  left join public.gift_reservations r on r.item_id = i.id
  where w.share_token::text = p_share_token
  group by w.id, w.owner_id;
$$;

create or replace function public.reserve_wishlist_item(
  p_share_token text,
  p_item_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_wishlist_id uuid;
  target_owner_id uuid;
  inserted_count integer;
begin
  select id, owner_id
    into target_wishlist_id, target_owner_id
  from public.wishlists
  where share_token::text = p_share_token;

  if target_wishlist_id is null or (select auth.uid()) = target_owner_id then
    return false;
  end if;

  if not exists (
    select 1
    from public.wishlist_items
    where id = p_item_id
      and wishlist_id = target_wishlist_id
      and status <> 'No longer want'
  ) then
    return false;
  end if;

  insert into public.gift_reservations (item_id)
  values (p_item_id)
  on conflict (item_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.get_shared_wishlist(text) from public;
revoke all on function public.reserve_wishlist_item(text, text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
grant execute on function public.reserve_wishlist_item(text, text) to anon, authenticated;
