import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/wishlist-html.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
});
const helpers = {};
new Function("exports", compiled.outputText)(helpers);
const { buildWishlistHtml, parseWishlistData, mergeWishlistItems } = helpers;

const item = {
  id: "gift-1",
  title: "Blue bag & ribbon",
  productUrl: "https://example.com/gift?color=blue&size=small",
  imageUrl: "https://example.com/photo.jpg",
  notes: "Size small\nWith a ribbon",
  status: "Still want",
  addedAt: "2026-10-27T12:00:00.000Z",
};

function readExport(html) {
  return html.match(/<script type="application\/json" id="aesthetic-wishlist-data">([\s\S]*?)<\/script>/)[1];
}

function dataFor(items) {
  return JSON.stringify({ format: "aesthetic-wishlist", version: 1, items });
}

test("HTML is readable and round-trips all statuses, Unicode, and original fields", () => {
  const items = helpers.statusOptions.map((status, index) => ({
    ...item,
    id: `gift-${index}`,
    title: `Caf\u00e9 \u2764 ${index}`,
    status,
  }));
  const html = buildWishlistHtml(items);

  assert.match(html, /<!doctype html>/);
  assert.doesNotMatch(html, /Buy \/ view item/);
  assert.match(html, /Oct 27, 2026/);
  assert.equal((html.match(/<article>/g) ?? []).length, 4);
  assert.deepEqual(parseWishlistData(readExport(html)), items);
});

test("the entire exported card links to its product, with or without a photo", () => {
  for (const imageUrl of [item.imageUrl, ""]) {
    const html = buildWishlistHtml([{ ...item, imageUrl }]);
    const link = html.match(/<a class="card-link"([^>]*)>([\s\S]*?)<\/a>/);

    assert.ok(link);
    assert.match(link[1], /href="https:\/\/example\.com\/gift\?color=blue&amp;size=small"/);
    assert.match(link[1], /target="_blank" rel="noopener noreferrer"/);
    assert.match(link[1], /aria-label="View Blue bag &amp; ribbon \(opens in a new tab\)"/);
    assert.match(link[2], /^<article>[\s\S]*<h2>Blue bag &amp; ribbon<\/h2>[\s\S]*<\/article>$/);
    assert.equal((html.match(/<a\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /Buy \/ view item/);
  }
});

test("all star priorities round-trip and appear on exported cards", () => {
  for (const [priority, label] of [
    [1, "Just browsing"],
    [2, "Would be nice"],
    [3, "Love this"],
  ]) {
    const prioritized = { ...item, priority };
    const html = buildWishlistHtml([prioritized]);

    assert.deepEqual(parseWishlistData(readExport(html)), [prioritized]);
    assert.ok(html.includes(`${"&#9733;".repeat(priority)}${"&#9734;".repeat(3 - priority)}`));
    assert.ok(html.includes(`${priority} of 3 stars: </span> ${label}`));
  }
});

test("older exports without priority remain importable and display as Just browsing", () => {
  const html = buildWishlistHtml([item]);

  assert.deepEqual(parseWishlistData(readExport(html)), [item]);
  assert.match(html, /1 of 3 stars: <\/span> Just browsing/);
  assert.equal(helpers.getPriorityOption(undefined).value, 1);
});

test("import rejects invalid star priorities", () => {
  for (const priority of [0, 4, -1, 1.5, "3", null, {}, []]) {
    assert.throws(
      () => parseWishlistData(dataFor([{ ...item, priority }])),
      /invalid wishlist item/,
    );
  }
});

test("export escapes markup, attributes, and embedded JSON without losing text", () => {
  const malicious = {
    ...item,
    title: '</script><img src=x onerror="alert(1)">',
    notes: "<script>alert('notes')</script> & more",
    imageUrl: 'https://example.com/" onerror="alert(1)',
  };
  const html = buildWishlistHtml([malicious]);

  assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onerror=&quot;/);
  assert.doesNotMatch(html, /src="[^"]*" onerror="/);
  assert.deepEqual(parseWishlistData(readExport(html)), [malicious]);
});

test("export omits unsafe links and import rejects unsafe URLs and invalid items", () => {
  for (const productUrl of ["javascript:alert(1)", "data:text/html,test", "/relative"]) {
    const unsafe = { ...item, productUrl };
    assert.doesNotMatch(buildWishlistHtml([unsafe]), /href=/);
    assert.throws(() => parseWishlistData(dataFor([unsafe])), /invalid wishlist item/);
  }

  for (const override of [
    { imageUrl: "javascript:alert(1)" },
    { status: "Unknown" },
    { addedAt: "not a date" },
    { title: "" },
    { id: "" },
    { notes: 42 },
  ]) {
    assert.throws(() => parseWishlistData(dataFor([{ ...item, ...override }])));
  }
  assert.throws(() => parseWishlistData(dataFor([item, item])), /invalid wishlist item/);
});

test("import rejects unrelated, malformed, and unsupported files", () => {
  for (const json of [
    "{",
    "null",
    "[]",
    JSON.stringify({ items: [item] }),
    JSON.stringify({ format: "aesthetic-wishlist", version: 2, items: [item] }),
    dataFor([null]),
  ]) {
    assert.throws(() => parseWishlistData(json));
  }
});

test("merge preserves existing edits and skips duplicates on repeated imports", () => {
  const existing = { ...item, notes: "My local edit", status: "Bought", priority: 3 };
  const addition = { ...item, id: "gift-2", priority: 2 };
  const merged = mergeWishlistItems([existing], [item, addition, addition]);

  assert.deepEqual(merged, [addition, existing]);
  assert.deepEqual(mergeWishlistItems(merged, [item, addition]), merged);
  assert.deepEqual(mergeWishlistItems(merged, []), merged);
  assert.deepEqual(parseWishlistData(readExport(buildWishlistHtml([]))), []);
});
