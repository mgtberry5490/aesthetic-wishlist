export const statusOptions = [
  "Thinking about it",
  "Still want",
  "Bought",
  "No longer want",
] as const;

export type WishStatus = (typeof statusOptions)[number];

export const priorityOptions = [
  { value: 1, label: "Just browsing" },
  { value: 2, label: "Would be nice" },
  { value: 3, label: "Love this" },
] as const;

export type WishPriority = (typeof priorityOptions)[number]["value"];

export function getPriorityOption(priority?: WishPriority) {
  return priorityOptions.find((option) => option.value === priority) ?? priorityOptions[0];
}

export type WishlistItem = {
  id: string;
  title: string;
  productUrl: string;
  imageUrl: string;
  notes: string;
  status: WishStatus;
  priority?: WishPriority;
  addedAt: string;
};

function isWebUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export function parseWishlistData(json: string): WishlistItem[] {
  const data: unknown = JSON.parse(json);

  if (
    !data ||
    typeof data !== "object" ||
    !("format" in data) ||
    data.format !== "aesthetic-wishlist" ||
    !("version" in data) ||
    data.version !== 1 ||
    !("items" in data) ||
    !Array.isArray(data.items)
  ) {
    throw new Error("Choose an HTML file exported from this wishlist app.");
  }

  const ids = new Set<string>();

  return data.items.map((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      ids.has(item.id) ||
      !("title" in item) ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      !("productUrl" in item) ||
      typeof item.productUrl !== "string" ||
      !isWebUrl(item.productUrl) ||
      !("imageUrl" in item) ||
      typeof item.imageUrl !== "string" ||
      (item.imageUrl !== "" && !isWebUrl(item.imageUrl)) ||
      !("notes" in item) ||
      typeof item.notes !== "string" ||
      !("status" in item) ||
      !statusOptions.some((status) => status === item.status) ||
      ("priority" in item && !priorityOptions.some((option) => option.value === item.priority)) ||
      !("addedAt" in item) ||
      typeof item.addedAt !== "string" ||
      !Number.isFinite(new Date(item.addedAt).getTime())
    ) {
      throw new Error("This file contains an invalid wishlist item. Your list was not changed.");
    }

    ids.add(item.id);

    return {
      id: item.id,
      title: item.title,
      productUrl: item.productUrl,
      imageUrl: item.imageUrl,
      notes: item.notes,
      status: item.status as WishStatus,
      ...("priority" in item ? { priority: item.priority as WishPriority } : {}),
      addedAt: item.addedAt,
    };
  });
}

export function mergeWishlistItems(current: WishlistItem[], incoming: WishlistItem[]) {
  const ids = new Set(current.map((item) => item.id));
  const additions = incoming.filter((item) => {
    if (ids.has(item.id)) {
      return false;
    }

    ids.add(item.id);
    return true;
  });

  return [...additions, ...current];
}

export function buildWishlistHtml(items: WishlistItem[]) {
  // Keep the embedded JSON inert, including titles containing a closing script tag.
  const data = JSON.stringify({
    format: "aesthetic-wishlist",
    version: 1,
    items,
  }).replaceAll("<", "\\u003c");
  const cards = items.map((item) => {
    const priority = getPriorityOption(item.priority);
    const productUrl = isWebUrl(item.productUrl) ? item.productUrl : "";
    const imageUrl = isWebUrl(item.imageUrl) ? item.imageUrl : "";
    const date = new Date(item.addedAt);
    const addedAt = Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
      : item.addedAt;

    const card = `<article>
${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer">` : ""}
<div class="details">
<p class="date">Added ${escapeHtml(addedAt)}</p>
<h2>${escapeHtml(item.title)}</h2>
<p class="status">${escapeHtml(item.status)}</p>
<p class="priority"><span aria-hidden="true">${"&#9733;".repeat(priority.value)}${"&#9734;".repeat(3 - priority.value)}</span><span class="sr-only">${priority.value} of 3 stars: </span> ${priority.label}</p>
${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
</div>
</article>`;

    return productUrl
      ? `<a class="card-link" href="${escapeHtml(productUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(item.title)} (opens in a new tab)">${card}</a>`
      : card;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>My wishlist</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; background: #eef6ff; color: #172033; font: 16px/1.6 system-ui, sans-serif; }
main { max-width: 1200px; margin: auto; padding: 32px 20px; }
header, article { background: #f8fbff; border: 1px solid white; border-radius: 28px; box-shadow: 0 12px 30px #47658715; overflow: hidden; }
article { height: 100%; }
header { padding: 28px; margin-bottom: 24px; }
h1 { margin: 0; font-size: 36px; }
h2 { font-size: 22px; margin: 8px 0; overflow-wrap: anywhere; }
.board { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 20px; }
img { display: block; width: 100%; height: 280px; object-fit: cover; background: #dcecff; }
.details { padding: 24px; }
.date { color: #5f83aa; font-size: 13px; margin: 0; }
.status { display: inline-block; border-radius: 20px; background: #e6f0fb; padding: 4px 12px; font-size: 13px; }
.priority { color: #825a20; font-size: 13px; margin: 8px 0; }
.priority > span:first-child { color: #b17a25; letter-spacing: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.notes { white-space: pre-wrap; overflow-wrap: anywhere; }
.card-link { display: block; color: inherit; border-radius: 28px; text-decoration: none; }
.card-link:hover article { box-shadow: 0 12px 30px #47658735; }
.card-link:focus-visible { outline: 3px solid #5b8cc5; outline-offset: 4px; }
@media print { header, article { box-shadow: none; } article { break-inside: avoid; } }
</style>
</head>
<body>
<main>
<header>
<h1>My wishlist</h1>
<p>${items.length} saved ${items.length === 1 ? "find" : "finds"} &middot; A read-only snapshot of my list.</p>
<p>Click any card to shop. Photos need an internet connection. To add this list to your wishlist app, use Import HTML and choose this file.</p>
</header>
<section class="board" aria-label="Wishlist items">
${cards || "<p>No saved finds yet.</p>"}
</section>
</main>
<script type="application/json" id="aesthetic-wishlist-data">${data}</script>
</body>
</html>`;
}
