import { getProductTitleFromUrl } from "@/lib/product-preview";

type PreviewResponse = {
  title: string;
  imageUrl: string;
  message?: string;
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

  const suggestedTitle = getProductTitleFromUrl(productUrl);
  const unavailablePreview = (error: string, status: number) => {
    if (suggestedTitle) {
      return Response.json({
        title: suggestedTitle,
        imageUrl: "",
        message:
          "The store preview is unavailable. I suggested a name from the link; you can edit it, add your own photo link, or save without a photo.",
      });
    }

    return Response.json(
      { error: `${error} Enter an item name below; a photo is optional.` },
      { status },
    );
  };

  try {
    const response = await fetch(productUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AestheticWishlistPreview/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return unavailablePreview(
        `The store returned ${response.status}, so I could not preview it.`,
        502,
      );
    }

    const html = textDecoder.decode((await response.arrayBuffer()).slice(0, maxHtmlBytes));
    const preview: PreviewResponse = {
      title: getTitle(html),
      imageUrl: getImageUrl(html, productUrl),
    };

    if (!preview.title && !preview.imageUrl) {
      return unavailablePreview(
        "I could not find a title or image on that page.",
        404,
      );
    }

    if (!preview.title) {
      preview.title = suggestedTitle;
    }

    if (!preview.imageUrl) {
      preview.message =
        "Found the item name, but no photo. You can add your own photo link or save without one.";
    }

    return Response.json(preview);
  } catch (error) {
    return unavailablePreview(
      error instanceof Error
        ? `I could not reach that product page: ${error.message}`
        : "I could not reach that product page.",
      502,
    );
  }
}
