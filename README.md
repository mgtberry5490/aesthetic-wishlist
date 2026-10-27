# Aesthetic Wishlist

A cozy wishlist web app for saving things you find online, seeing them later with photos and dates, and sharing a read-only birthday list with family.

The first version is intentionally simple: it runs fully in the browser, stores your personal list in `localStorage`, and creates a shareable family link by encoding the current wishlist into the URL.

## Current features

- Add wishlist items with:
  - product URL
  - auto-filled item name when available
  - optional image URL, auto-filled when available
  - notes
  - status
  - automatic date added
- See items as aesthetic cards with large product photos.
- Change an item status:
  - `Thinking about it`
  - `Still want`
  - `Bought`
  - `No longer want`
- Remove items from your personal list.
- Edit saved item names, links, photos, notes, and statuses without changing their original date added.
- Use the three-dot menu on a card to copy its product link, edit it, change its status, or remove it.
- Copy a read-only family share link.
- Export the full list as a standalone HTML file to send or keep as a backup.
- Import an exported HTML file to add missing items without replacing existing items.
- Family can click **Buy / view item** to open the original product page.
- Shared links exclude items marked `No longer want`.
- Preview the wishlist card live before saving it.\n- Open the compact **How it works** modal from the add-item form.

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
- Browser `localStorage` for the current MVP

## Project structure

```text
src/app/
  api/preview/route.ts  Server route that fetches title/image metadata for pasted links
  globals.css   Global Tailwind import and base styles
  layout.tsx    Root layout and metadata
  page.tsx      Main wishlist app UI and client-side state
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

## HTML export and import

Use **Export HTML** in the Family mode panel to download a readable copy of your
entire list, including items marked `No longer want`. Send the file as an attachment;
recipients can open it in a browser and follow the product links without running
the app. Photos still need an internet connection.

Use **Import HTML** in the app to choose a previously exported file. Missing items
are added with their original notes, dates, and statuses. Items with IDs already
on your list are skipped, preserving your local edits. Importing the same file
again will not add duplicates. Only this app's exported HTML format is supported.

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
- The share link currently stores wishlist data in the URL. That is good for an MVP, but not ideal for long-term private sharing.
- Do not put sensitive information in wishlist notes while share links are URL-encoded this way.

## Current data model

The MVP uses this TypeScript shape in `src/app/page.tsx`:

```ts
type WishStatus = "Thinking about it" | "Still want" | "Bought" | "No longer want";

type WishlistItem = {
  id: string;
  title: string;
  productUrl: string;
  imageUrl: string;
  notes: string;
  status: WishStatus;
  addedAt: string;
};
```

## Suggested next milestones

1. Add a real backend and database so share links are short and persistent.
2. Add user accounts so each person has private wishlists.
3. Add multiple lists, like Birthday, Holidays, Home, Books, and Clothes.
4. Improve automatic link previews with price extraction and store-specific fallbacks.
5. Add gift reservation so family can privately mark an item as claimed.
6. Add priority tags like `love`, `maybe`, and `practical`.
7. Add a browser extension or bookmarklet for one-click saving.

## Backend idea for the next version

Recommended models:

```text
User
Wishlist
WishlistItem
GiftReservation
```

`WishlistItem` should store:

```text
title
productUrl
imageUrl
price
storeName
notes
status
addedAt
wishlistId
```

`GiftReservation` can later store:

```text
wishlistItemId
reservedByName
reservedAt
message
```

Reservations should be hidden from the wishlist owner by default so gifts can stay a surprise.
