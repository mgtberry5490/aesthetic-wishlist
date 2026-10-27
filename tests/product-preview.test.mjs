import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function loadModule(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("exports", "require", compiled.outputText)(exports, (name) => {
    if (!(name in imports)) {
      throw new Error(`Unexpected import: ${name}`);
    }
    return imports[name];
  });
  return exports;
}

const helpers = loadModule("../src/lib/product-preview.ts");
const { GET } = loadModule("../src/app/api/preview/route.ts", {
  "@/lib/product-preview": helpers,
});
const rackUrl = "https://www.nordstromrack.com/s/blu-pepper-floral-cap-sleeve-maxi-dress/9115737?color=44444GVJ5D";
const sephoraUrl = "https://www.sephora.com/product/rare-beauty-by-selena-gomez-soft-pinch-liquid-blush-P97989778";

function requestFor(url) {
  return new Request(`http://localhost/api/preview?url=${encodeURIComponent(url)}`);
}

test("suggests product names only for supported product URL paths", () => {
  const { getProductTitleFromUrl } = helpers;
  assert.equal(getProductTitleFromUrl(new URL(rackUrl)), "Blu Pepper Floral Cap Sleeve Maxi Dress");
  assert.equal(getProductTitleFromUrl(new URL(sephoraUrl)), "Rare Beauty By Selena Gomez Soft Pinch Liquid Blush");
  assert.equal(getProductTitleFromUrl(new URL("https://www.nordstrom.com/s/blue-dress/123")), "Blue Dress");
  assert.equal(getProductTitleFromUrl(new URL("https://www.nordstromrack.com/s/caf%C3%A9-bag/123")), "Caf\u00e9 Bag");
  for (const url of [
    "https://www.nordstromrack.com/c/women",
    "https://www.sephora.com/shop/makeup",
    "https://example.com/product/blue-dress-P123",
    "https://www.sephora.com/product/%invalid-P123",
  ]) {
    assert.equal(getProductTitleFromUrl(new URL(url)), "");
  }
});

test("blocked stores, empty pages, and timeouts provide a usable suggested title", async (t) => {
  for (const [url, response] of [
    [rackUrl, () => new Response("<html><title></title><script>challenge()</script></html>")],
    [sephoraUrl, () => new Response("Access Denied", { status: 403 })],
    [rackUrl, () => { throw new Error("Request timed out"); }],
  ]) {
    t.mock.method(globalThis, "fetch", async () => response());
    const result = await GET(requestFor(url));
    const preview = await result.json();
    assert.equal(result.status, 200);
    assert.equal(preview.title, helpers.getProductTitleFromUrl(new URL(url)));
    assert.equal(preview.imageUrl, "");
    assert.match(preview.message, /suggested a name from the link/);
    t.mock.restoreAll();
  }
});

test("working store previews keep real titles and images, with optional-photo guidance when missing", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(
    '<meta property="og:title" content="Actual product name"><meta property="og:image" content="/photo.jpg">',
  ));
  let result = await GET(requestFor(rackUrl));
  assert.deepEqual(await result.json(), {
    title: "Actual product name",
    imageUrl: "https://www.nordstromrack.com/photo.jpg",
  });

  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response("<title>Actual product name</title>"));
  result = await GET(requestFor(rackUrl));
  const preview = await result.json();
  assert.equal(preview.title, "Actual product name");
  assert.equal(preview.imageUrl, "");
  assert.match(preview.message, /save without one/);
});

test("unsupported blocked stores still allow manual entry and invalid URLs remain rejected", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Denied", { status: 403 }));
  const result = await GET(requestFor("https://example.com/product"));
  assert.equal(result.status, 502);
  assert.match((await result.json()).error, /photo is optional/);
  assert.equal((await GET(requestFor("javascript:alert(1)"))).status, 400);
});
