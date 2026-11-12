# Wishful

A family-friendly wishlist app for saving things you find online, seeing them later with photos and dates, and sharing live lists.

Lists can stay local in the browser or sync to an account through Supabase.

## Current features

- Add wishlist items with:
  - product URL
  - auto-filled item name when available
  - optional image URL, auto-filled when available
  - notes
  - status
  - automatic date added
- See wishlist cards in a saved 2, 4, 6, or 8-column grid on phones and larger
  screens. Compact tiles prioritize the photo or item name and link directly to
  the product; use **Details** to expand notes, date, status, and priority.
- Change an item status:
  - `Thinking about it`
  - `Still want`
  - `Bought`
  - `No longer want`
- Remove items from your personal list.
- Edit saved item names, links, photos, notes, and statuses without changing their original date added.
- Set a star priority: 1 star for `Just browsing`, 2 for `Would be nice`, or 3 for `Love this`.
- See priorities on cards, the live preview, and family share links. Older items default to 1 star until you change them.
- Use the three-dot menu on a card to copy its product link, edit it, change its status, or remove it.
- Sign in with an email and password to sync a wishlist across devices. The session is remembered on the current device until sign-out.
- Open Settings from the gear button to change the theme or accent color, import
  an HTML backup, or sign out when signed in.
- By default, wishlist cards show 2 columns on smaller screens and 4 on larger
  screens. Choose 2, 4, 6, or 8 in Settings to keep that count on every screen.
- Copy a live family link that reflects list changes and guest gift reservations.
- Let guests mark an item as bought without signing in or identifying themselves. The signed-in owner dashboard does not show reservations.
- Import a previously exported HTML file from Settings to add missing items
  without replacing existing items.
- Family can click **Buy / view item** to open the original product page or mark the gift as bought.
- Shared links exclude items marked `No longer want`.
- Preview the wishlist card live before saving it.
- Open the compact **How it works** modal from the add-item form.
- Switch between light and dark appearance, and choose a saved accent color from Settings.
- Use the simplified **My list / Add a find** navigation on mobile; the live
  preview stays hidden on small screens to keep the form focused.
- Collapse or expand the introduction beneath **Good finds. Shared joy.**

## Vibe and product direction

The app should feel more like a soft curated mood board than a spreadsheet.

Design direction:

- soft powder blue background
- layered sky blue, mist, and slate accents
- rounded cards
- gentle shadows
- large images
- friendly copy
- simple, calm controls

Future UI changes should preserve that aesthetic unless Madelyn asks for a different style.

## Tech stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth and Postgres for account-backed lists
- Browser `localStorage` for lists that have not been moved to an account

## Project structure

```text
src/app/
  api/preview/route.ts  Server route that fetches title/image metadata for pasted links
  globals.css   Global Tailwind import and base styles
  layout.tsx    Root layout and metadata
  page.tsx      Main wishlist app UI and client-side state
  settings/page.tsx  Signed-in account, theme, and accent settings
src/lib/
  appearance.ts  Shared saved appearance preferences
```

## Getting started

From this folder:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

On Windows, the project was created at:

```text
E:\aesthetic-wishlist
```

## Validation commands

Run these before considering changes complete:

```bash
npm run lint
npm run build
```

Both commands passed after the initial MVP implementation.

Export/import checks can also be run with `npm test`.

## Account sync and live sharing

1. Create a Supabase project and enable the Email provider for password sign-in.
2. Run [`supabase/migrations/20261109000000_cloud_wishlists.sql`](./supabase/migrations/20261109000000_cloud_wishlists.sql) in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project API settings.
4. In Supabase Auth URL Configuration, set the site URL to your app URL and allow the local and deployed redirect URLs.
5. In Authentication provider settings for Email, turn off **Confirm email** to create accounts without sending email. This allows unverified email addresses, so use a strong unique password.
6. Restart the Next.js dev server, create an account with an email and password, and sign in. Supabase remembers the session on that browser/device until sign-out.

Only the public anon key belongs in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a Supabase service-role key in the browser or a `NEXT_PUBLIC_` variable.

After signing in, use **Copy this device's list to my account** to copy existing local items into the account. This is an explicit action so one person's local data is not silently uploaded when another person signs in on the same browser.

Share **Copy live family link** for an updating list. Visitors do not need an account. Reservations are stored separately from wishlist item status, do not include a buyer identity, and are not readable through the owner's account policies. The owner dashboard continues to show the original wishlist status. Anyone opening the public guest link can see which items have been marked bought; use the signed-in dashboard to view the list privately.

## Import an older HTML backup

Use **Import HTML** to choose a wishlist file exported by an earlier version of
the app. Missing items are added with their original notes, dates, and statuses.
Items with IDs already on your list are skipped, preserving your local edits.
Importing the same file again will not add duplicates. New lists should be shared
with a live family link.

## Important notes for future AI sessions

This project includes `AGENTS.md` and `CLAUDE.md` with a Next.js-specific rule:

> This is NOT the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing code.

Before changing Next.js app files, read the relevant local docs under:

```text
node_modules\next\dist\docs\
```

For the current implementation, the most relevant docs were:

```text
node_modules\next\dist\docs\01-app\01-getting-started\03-layouts-and-pages.md
node_modules\next\dist\docs\01-app\01-getting-started\05-server-and-client-components.md
node_modules\next\dist\docs\01-app\01-getting-started\11-css.md
node_modules\next\dist\docs\01-app\01-getting-started\15-route-handlers.md
```

Also note:

- `page.tsx` is a Client Component because it uses form state, `localStorage`, clipboard access, and browser URLs.
- `src/app/api/preview/route.ts` fetches pasted product pages server-side and reads Open Graph / Twitter metadata for title and image.
- External product images are rendered as CSS background images so the MVP does not need Next image remote host configuration yet.
- Auto-preview will not work for every store. Some stores block server fetches or do not publish preview metadata, so the form still allows manual title and image edits.
- If a Sephora, Nordstrom, or Nordstrom Rack product preview is unavailable, the app suggests an editable name from the product link. Photos are optional, so blocked previews never prevent saving an item.
- Local-only share links encode the list in the URL and are snapshots. Account-backed live links use a random share token and read current items from Supabase.
- Live links are public bearer links: anyone with the link can see the shared list and reservation flags. Do not put sensitive information in wishlist notes.

## Current data model

Wishlist items use this TypeScript shape in `src/lib/wishlist-html.ts` and are stored
in Supabase for signed-in accounts:

```ts
type WishStatus = "Thinking about it" | "Still want" | "Bought" | "No longer want";

type WishlistItem = {
  id: string;
  title: string;
  productUrl: string;
  imageUrl: string;
  notes: string;
  status: WishStatus;
  priority?: 1 | 2 | 3;
  addedAt: string;
};
```

## Backend data model

```text
auth.users
wishlists
wishlist_items
gift_reservations
```

`wishlist_items` stores:

```text
id
wishlist_id
title
product_url
image_url
notes
status
priority
added_at
```

`gift_reservations` intentionally stores only:

```text
item_id
reserved_at
```

It does not store a buyer name or account ID. Row-level security blocks direct
access to reservations. The public database functions return only the bought
flag, and suppress that flag for the signed-in owner.
