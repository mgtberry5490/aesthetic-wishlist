type PreviewResponse = {
  title: string;
  imageUrl: string;
};

const textDecoder = new TextDecoder();
const maxHtmlBytes = 500_000;

function getMetaContent(html: string, attributeName: "property" | "name", attributeValue: string) {
  const escapedAttributeValue = attributeValue.replaceAll(":", "\\:");
  const pattern = new RegExp(
    `<meta[^>]+${attributeName}=["']${escapedAttributeValue}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${escapedAttributeValue}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);

  return match?.[1] ?? match?.[2] ?? "";
}

function getTitle(html: string) {
  const title =
    getMetaContent(html, "property", "og:title") ||
    getMetaContent(html, "name", "twitter:title") ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "";

  return decodeHtml(title.trim());
}

function getImageUrl(html: string, productUrl: URL) {
  const imageUrl =
    getMetaContent(html, "property", "og:image") ||
    getMetaContent(html, "property", "og:image:url") ||
    getMetaContent(html, "name", "twitter:image") ||
    getMetaContent(html, "name", "twitter:image:src");

  if (!imageUrl) {
    return "";
  }

  return new URL(decodeHtml(imageUrl.trim()), productUrl).toString();
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function validateProductUrl(value: string | null) {
  if (!value) {
    return null;
  }

  let productUrl: URL;

  try {
    productUrl = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(productUrl.protocol)) {
    return null;
  }

  return productUrl;
}

export async function GET(request: Request) {
  const productUrl = validateProductUrl(new URL(request.url).searchParams.get("url"));

  if (!productUrl) {
    return Response.json({ error: "Add a valid http or https product link." }, { status: 400 });
  }

  try {
    const response = await fetch(productUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AestheticWishlistPreview/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `The store returned ${response.status}, so I could not preview it.` },
        { status: 502 },
      );
    }

    const html = textDecoder.decode((await response.arrayBuffer()).slice(0, maxHtmlBytes));
    const preview: PreviewResponse = {
      title: getTitle(html),
      imageUrl: getImageUrl(html, productUrl),
    };

    if (!preview.title && !preview.imageUrl) {
      return Response.json(
        { error: "I could not find a title or image on that page." },
        { status: 404 },
      );
    }

    return Response.json(preview);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `I could not reach that product page: ${error.message}`
            : "I could not reach that product page.",
      },
      { status: 502 },
    );
  }
}
