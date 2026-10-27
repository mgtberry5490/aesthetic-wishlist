export function getProductTitleFromUrl(productUrl: URL) {
  const hostname = productUrl.hostname.replace(/^www\./, "");
  const parts = productUrl.pathname.split("/").filter(Boolean);
  let slug = "";

  if (hostname === "nordstrom.com" || hostname === "nordstromrack.com") {
    const productIndex = parts.indexOf("s");
    slug = productIndex >= 0 ? parts[productIndex + 1] ?? "" : "";
  } else if (hostname === "sephora.com" && parts[0] === "product") {
    slug = (parts.at(-1) ?? "").replace(/-P\d+$/i, "");
  }

  try {
    return decodeURIComponent(slug)
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}
