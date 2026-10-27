"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  buildWishlistHtml,
  mergeWishlistItems,
  parseWishlistData,
  statusOptions,
  type WishlistItem,
  type WishStatus,
} from "@/lib/wishlist-html";

type LinkPreview = {
  title: string;
  imageUrl: string;
  message?: string;
};

type PreviewState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

const storageKey = "aesthetic-wishlist-items";

const starterItems: WishlistItem[] = [
  {
    id: "starter-velvet-bag",
    title: "Velvet crescent shoulder bag",
    productUrl: "https://www.etsy.com/",
    imageUrl:
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80",
    notes: "Soft neutral color, gold hardware if there are options.",
    status: "Still want",
    addedAt: "2026-07-16T12:00:00.000Z",
  },
  {
    id: "starter-cozy-candle",
    title: "Cozy vanilla candle",
    productUrl: "https://www.target.com/",
    imageUrl:
      "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=900&q=80",
    notes: "Anything warm, soft, and not too floral.",
    status: "Thinking about it",
    addedAt: "2026-07-15T12:00:00.000Z",
  },
  {
    id: "starter-book",
    title: "Pretty coffee table book",
    productUrl: "https://bookshop.org/",
    imageUrl:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80",
    notes: "Design, interiors, fashion, or art would be cute.",
    status: "Thinking about it",
    addedAt: "2026-07-13T12:00:00.000Z",
  },
];

const emptyForm = {
  title: "",
  productUrl: "",
  imageUrl: "",
  notes: "",
  status: "Thinking about it" as WishStatus,
};

const idlePreviewState: PreviewState = {
  status: "idle",
  message: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function getStoreName(productUrl: string) {
  try {
    return new URL(productUrl).hostname.replace(/^www\./, "");
  } catch {
    return "store link";
  }
}

function encodeShareItems(items: WishlistItem[]) {
  const shareableItems = items.filter((item) => item.status !== "No longer want");
  const json = JSON.stringify(shareableItems);

  return btoa(encodeURIComponent(json))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeShareItems(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const paddedValue = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(paddedValue.replaceAll("-", "+").replaceAll("_", "/")),
    );
    const parsedItems = JSON.parse(json) as WishlistItem[];

    if (!Array.isArray(parsedItems)) {
      return null;
    }

    return parsedItems;
  } catch {
    return null;
  }
}

function subscribeToBrowserSnapshot() {
  return () => {};
}

function getServerSnapshot() {
  return "";
}

function getStoredWishlistSnapshot() {
  return window.localStorage.getItem(storageKey) ?? "";
}

function getShareSnapshot() {
  return new URLSearchParams(window.location.search).get("share") ?? "";
}

function getBrowserReadySnapshot() {
  return "ready";
}

function parseStoredWishlistItems(value: string) {
  if (!value) {
    return starterItems;
  }

  try {
    return JSON.parse(value) as WishlistItem[];
  } catch (error) {
    console.warn("Could not load saved wishlist items.", error);
    return starterItems;
  }
}

export default function Home() {
  const storedWishlistSnapshot = useSyncExternalStore(
    subscribeToBrowserSnapshot,
    getStoredWishlistSnapshot,
    getServerSnapshot,
  );
  const shareSnapshot = useSyncExternalStore(
    subscribeToBrowserSnapshot,
    getShareSnapshot,
    getServerSnapshot,
  );
  const browserReadySnapshot = useSyncExternalStore(
    subscribeToBrowserSnapshot,
    getBrowserReadySnapshot,
    getServerSnapshot,
  );
  const savedItems = useMemo(
    () => parseStoredWishlistItems(storedWishlistSnapshot),
    [storedWishlistSnapshot],
  );
  const [draftItems, setDraftItems] = useState<WishlistItem[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [itemActionMessage, setItemActionMessage] = useState("");
  const shareItems = useMemo(() => decodeShareItems(shareSnapshot), [shareSnapshot]);
  const [shareCopied, setShareCopied] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>(idlePreviewState);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [fileMessage, setFileMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const itemMenuRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewRequestIdRef = useRef(0);
  const items = draftItems ?? savedItems;
  const editingItem = items.find((item) => item.id === editingItemId);
  const isBrowserReady = browserReadySnapshot === "ready";

  useEffect(() => {
    if (!isBrowserReady || shareItems) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [isBrowserReady, items, shareItems]);

  useEffect(() => {
    if (openItemMenuId === null) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !itemMenuRef.current?.contains(event.target)) {
        setOpenItemMenuId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        itemMenuRef.current?.querySelector("button")?.focus();
        setOpenItemMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openItemMenuId]);

  const visibleItems = shareItems ?? items;
  const shareLink = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}${window.location.pathname}?share=${encodeShareItems(items)}`;
  }, [items]);

  const resetForm = () => {
    previewRequestIdRef.current += 1;

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    setForm(emptyForm);
    setEditingItemId(null);
    setPreviewState(idlePreviewState);
  };

  const editItem = (item: WishlistItem) => {
    setOpenItemMenuId(null);
    resetForm();
    setEditingItemId(item.id);
    setForm({
      title: item.title,
      productUrl: item.productUrl,
      imageUrl: item.imageUrl,
      notes: item.notes,
      status: item.status,
    });
    formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus({
      preventScroll: true,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyItemLink = async (item: WishlistItem) => {
    setOpenItemMenuId(null);

    try {
      await navigator.clipboard.writeText(item.productUrl);
      setItemActionMessage(`Link copied for ${item.title}.`);
    } catch {
      setItemActionMessage("Could not copy the link. Please try again.");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const details = {
      title: form.title.trim(),
      productUrl: form.productUrl.trim(),
      imageUrl: form.imageUrl.trim(),
      notes: form.notes.trim(),
      status: form.status,
    };

    if (editingItemId !== null) {
      setDraftItems((currentItems) =>
        (currentItems ?? items).map((item) =>
          item.id === editingItemId ? { ...item, ...details } : item,
        ),
      );
    } else {
      const newItem: WishlistItem = {
        ...details,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
      };

      setDraftItems((currentItems) => [newItem, ...(currentItems ?? items)]);
    }

    resetForm();
  };

  const fetchLinkPreview = async (productUrl: string, requestId: number) => {
    try {
      const response = await fetch(`/api/preview?url=${encodeURIComponent(productUrl)}`);
      const preview = (await response.json()) as Partial<LinkPreview> & {
        error?: string;
      };

      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        setPreviewState({
          status: "error",
          message: preview.error ?? "I could not read that page. You can still fill it in.",
        });
        return;
      }

      setForm((currentForm) => ({
        ...currentForm,
        title: currentForm.title || preview.title || "",
        imageUrl: currentForm.imageUrl || preview.imageUrl || "",
      }));
      setPreviewState({
        status: "success",
        message: preview.message ?? "Auto-filled what I could find. You can still edit it.",
      });
    } catch (error) {
      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      setPreviewState({
        status: "error",
        message:
          error instanceof Error
            ? `Preview failed: ${error.message}`
            : "Preview failed. You can still fill it in.",
      });
    }
  };

  const handleProductUrlChange = (productUrl: string) => {
    setForm((currentForm) => ({ ...currentForm, productUrl }));

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    previewRequestIdRef.current += 1;

    try {
      const parsedUrl = new URL(productUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        setPreviewState({
          status: "error",
          message: "Use a normal http or https product link.",
        });
        return;
      }
    } catch {
      setPreviewState(productUrl ? { status: "idle", message: "" } : idlePreviewState);
      return;
    }

    setPreviewState({
      status: "loading",
      message: "Looking for the item name and photo...",
    });

    const requestId = previewRequestIdRef.current;
    previewTimerRef.current = window.setTimeout(() => {
      void fetchLinkPreview(productUrl, requestId);
    }, 500);
  };

  const updateStatus = (id: string, status: WishStatus) => {
    setOpenItemMenuId(null);
    setDraftItems((currentItems) =>
      (currentItems ?? items).map((item) => (item.id === id ? { ...item, status } : item)),
    );

    if (id === editingItemId) {
      setForm((currentForm) => ({ ...currentForm, status }));
    }
  };

  const removeItem = (id: string) => {
    setOpenItemMenuId(null);
    setDraftItems((currentItems) => (currentItems ?? items).filter((item) => item.id !== id));

    if (id === editingItemId) {
      resetForm();
    }
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  const exportHtml = () => {
    try {
      const blob = new Blob([buildWishlistHtml(items)], {
        type: "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wishlist-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFileMessage("HTML exported with all items, including those marked No longer want.");
    } catch {
      setFileMessage("Could not export your list. Please try again.");
    }
  };

  const importHtml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsImporting(true);
    setFileMessage("");

    try {
      const html = await file.text();
      // Parse the file without loading its HTML or executing its scripts.
      const template = document.createElement("template");
      template.innerHTML = html;
      const data = template.content.querySelector(
        'script#aesthetic-wishlist-data[type="application/json"]',
      )?.textContent;

      if (!data) {
        throw new Error("Choose an HTML file exported from this wishlist app.");
      }

      const importedItems = parseWishlistData(data);
      const currentItems = parseStoredWishlistItems(
        window.localStorage.getItem(storageKey) ?? "",
      );
      const mergedItems = mergeWishlistItems(currentItems, importedItems);
      const addedCount = mergedItems.length - currentItems.length;
      const skippedCount = importedItems.length - addedCount;

      window.localStorage.setItem(storageKey, JSON.stringify(mergedItems));
      setDraftItems(mergedItems);
      setFileMessage(
        `Imported ${addedCount} ${addedCount === 1 ? "item" : "items"}. ${skippedCount} already on your list skipped.`,
      );
    } catch (error) {
      setFileMessage(
        error instanceof Error && !(error instanceof SyntaxError)
          ? error.message
          : "Could not read this wishlist file. Your list was not changed.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#eef6ff] text-[#172033]">
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute left-1/2 top-0 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#bcdcff] blur-3xl opacity-50" />
        <div className="absolute right-8 top-52 -z-0 h-72 w-72 rounded-full bg-[#d7e8ff] blur-3xl opacity-60" />

        <header className="relative z-10 grid gap-6 rounded-[2rem] border border-white/70 bg-white/55 p-6 shadow-2xl shadow-[#476587]/10 backdrop-blur md:grid-cols-[1.4fr_0.6fr] md:p-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#4f7fb5]">
              Birthday wish garden
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-[#101c2f] sm:text-6xl">
              Save pretty finds now, decide what you love later.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#52677d]">
              Add links, photos, notes, and the day you saved each idea. When
              family asks what to get you, send them the cozy read-only list.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-[#f8fbff] p-5 shadow-inner shadow-[#b9d4f2]/30">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#5f83aa]">
              Family mode
            </p>
            <p className="mt-3 text-3xl font-semibold">{visibleItems.length}</p>
            <p className="mt-2 text-sm leading-6 text-[#52677d]">
              {shareItems
                ? "You are viewing a shared list. Click Buy to open the item."
                : "Copy a share link so family can browse and buy from your list."}
            </p>
            {!shareItems && (
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="w-full rounded-full bg-[#172033] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#172033]/20 transition hover:-translate-y-0.5 hover:bg-[#284b78]"
                >
                  {shareCopied ? "Copied link" : "Copy family share link"}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={exportHtml}
                    disabled={!isBrowserReady || isImporting}
                    className="rounded-full border border-[#bdd3eb] bg-white px-4 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:opacity-50"
                  >
                    Export HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!isBrowserReady || isImporting}
                    className="rounded-full border border-[#bdd3eb] bg-white px-4 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:opacity-50"
                  >
                    {isImporting ? "Importing..." : "Import HTML"}
                  </button>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  aria-label="Import wishlist HTML file"
                  onChange={importHtml}
                  className="hidden"
                />
                <p className="text-xs leading-5 text-[#52677d]">
                  Export all items as a file to send or keep. Import adds missing
                  items without replacing your list.
                </p>
                <p role="status" className="text-sm leading-6 text-[#37618f]">
                  {fileMessage}
                </p>
              </div>
            )}
          </div>
        </header>

        {!shareItems && (
          <section className="relative z-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#4f7fb5]">
                {editingItem ? "Edit saved find" : "Add a new find"}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                {editingItem ? "Make it just right" : "Paste the thing you love"}
              </h2>
              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-[#344b63]">
                  Product link
                  <input
                    required
                    type="url"
                    value={form.productUrl}
                    onChange={(event) => handleProductUrlChange(event.target.value)}
                    placeholder="https://store.com/item"
                    className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                  />
                </label>
                {previewState.message && (
                  <p
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      previewState.status === "error"
                        ? "bg-[#f4dce3] text-[#8b4a58]"
                        : "bg-[#e8f2ff] text-[#37618f]"
                    }`}
                  >
                    {previewState.message}
                  </p>
                )}
                <label className="grid gap-2 text-sm font-medium text-[#344b63]">
                  Item name
                  <input
                    required
                    name="title"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Auto-filled from the product link"
                    className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#344b63]">
                  Image link (optional)
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(event) =>
                      setForm({ ...form, imageUrl: event.target.value })
                    }
                    placeholder="Paste a photo link, or leave this blank"
                    className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                  />
                </label>
                <p className="text-xs leading-5 text-[#52677d]">
                  Some stores do not allow automatic previews. You can still save
                  the product link and item name without a photo.
                </p>
                <label className="grid gap-2 text-sm font-medium text-[#344b63]">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Size, color, why you like it..."
                    rows={3}
                    className="resize-none rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#344b63]">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as WishStatus })
                    }
                    className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                  >
                    {statusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-[#5b8cc5] px-6 py-4 font-semibold text-white shadow-lg shadow-[#5b8cc5]/25 transition hover:-translate-y-0.5 hover:bg-[#4f7fb5]"
              >
                {editingItem ? "Save changes" : "Add to my wishlist"}
              </button>
              {editingItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="mt-3 w-full rounded-full border border-[#bdd3eb] bg-white px-6 py-3 font-semibold text-[#344b63] transition hover:bg-[#e8f2ff]"
                >
                  Cancel editing
                </button>
              )}
            </form>

            <div className="rounded-[2rem] border border-white/70 bg-white/45 p-6 shadow-xl shadow-[#476587]/10">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#5f83aa]">
                Live preview
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Your card before it saves</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#52677d]">
                As the link preview fills in, this shows exactly how the item
                will look on your wishlist board.
              </p>
              <button
                type="button"
                onClick={() => setIsHowItWorksOpen(true)}
                className="mt-5 rounded-full border border-[#bdd3eb] bg-white/70 px-4 py-2 text-xs font-semibold text-[#344b63] transition hover:bg-white"
              >
                How it works
              </button>
              <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/80 bg-[#f8fbff] shadow-xl shadow-[#476587]/10">
                <div
                  className="flex h-72 items-center justify-center bg-[#dcecff] bg-cover bg-center px-8 text-center text-sm font-semibold text-[#5f83aa]"
                  style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})` } : undefined}
                  role={form.imageUrl ? "img" : undefined}
                  aria-label={form.imageUrl ? form.title || "Wishlist item preview" : undefined}
                >
                  {!form.imageUrl && "Your product photo will appear here"}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5f83aa]">
                        {editingItem ? `Added ${formatDate(editingItem.addedAt)}` : "Added today"}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">
                        {form.title || "Item name preview"}
                      </h3>
                      <p className="mt-1 text-sm text-[#6a7f95]">
                        From {form.productUrl ? getStoreName(form.productUrl) : "store link"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e6f0fb] px-3 py-1 text-xs font-semibold text-[#36516b]">
                      {form.status}
                    </span>
                  </div>
                  <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[#52677d]">
                    {form.notes || "Notes like size, color, or why you love it will show here."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {isHowItWorksOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/35 px-5 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="how-it-works-title"
              className="relative w-full max-w-2xl rounded-[2rem] border border-white/80 bg-[#f8fbff] p-6 shadow-2xl shadow-[#172033]/20"
            >
              <button
                type="button"
                onClick={() => setIsHowItWorksOpen(false)}
                className="absolute right-5 top-5 rounded-full border border-[#bdd3eb] px-3 py-1 text-sm font-semibold text-[#52677d] transition hover:bg-[#f4dce3]"
              >
                Close
              </button>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#5f83aa]">
                How it works
              </p>
              <h2 id="how-it-works-title" className="mt-3 pr-16 text-3xl font-semibold">
                From browser find to birthday list
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  ["1", "Find it", "Open your browser, shop normally, and copy the item link."],
                  [
                    "2",
                    "Save it",
                    "Paste the link and the app will try to grab the name and photo.",
                  ],
                  ["3", "Share it", "Send family the read-only link so they can click Buy."],
                ].map(([step, title, copy]) => (
                  <div
                    key={step}
                    className="rounded-[1.5rem] bg-white p-5 shadow-sm shadow-[#476587]/10"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7e8ff] text-sm font-bold text-[#315f8f]">
                      {step}
                    </span>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#52677d]">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <section className="relative z-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#4f7fb5]">
                {shareItems ? "Shared birthday list" : "Your saved finds"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Wishlist board</h2>
            </div>
            {shareItems && (
              <Link
                href="/"
                className="rounded-full border border-[#bdd3eb] bg-white/70 px-5 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-white"
              >
                Back to my app
              </Link>
            )}
          </div>

          <p role="status" className="text-sm leading-6 text-[#37618f]">
            {itemActionMessage}
          </p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-[#f8fbff] shadow-xl shadow-[#476587]/10 transition hover:-translate-y-1"
              >
                {!shareItems && (
                  <div
                    ref={openItemMenuId === item.id ? itemMenuRef : undefined}
                    className="absolute right-4 top-4 z-10"
                  >
                    <button
                      type="button"
                      aria-label={`Actions for ${item.title}`}
                      aria-expanded={openItemMenuId === item.id}
                      onClick={() =>
                        setOpenItemMenuId((currentId) => currentId === item.id ? null : item.id)
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#bdd3eb] bg-white/95 text-[#344b63] shadow-sm transition hover:bg-[#e8f2ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b8cc5]"
                    >
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <circle cx="10" cy="4" r="1.75" />
                        <circle cx="10" cy="10" r="1.75" />
                        <circle cx="10" cy="16" r="1.75" />
                      </svg>
                    </button>
                    {openItemMenuId === item.id && (
                      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[#c9dcef] bg-white p-1 shadow-xl shadow-[#476587]/20">
                        <button
                          type="button"
                          onClick={() => void copyItemLink(item)}
                          className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] focus-visible:bg-[#e8f2ff]"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => editItem(item)}
                          className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] focus-visible:bg-[#e8f2ff]"
                        >
                          Edit
                        </button>
                        <label className="grid gap-2 border-y border-[#e6f0fb] px-4 py-3 text-xs font-semibold text-[#5f83aa]">
                          Status
                          <select
                            aria-label={`Status for ${item.title}`}
                            value={item.status}
                            onChange={(event) =>
                              updateStatus(item.id, event.target.value as WishStatus)
                            }
                            className="w-full rounded-xl border border-[#bdd3eb] bg-white px-2 py-2 text-sm font-semibold text-[#344b63]"
                          >
                            {statusOptions.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#8b4a58] transition hover:bg-[#f4dce3] focus-visible:bg-[#f4dce3]"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div
                  className="flex h-72 items-center justify-center bg-[#dcecff] bg-cover bg-center px-8 text-center text-sm font-semibold text-[#5f83aa]"
                  style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                  role={item.imageUrl ? "img" : undefined}
                  aria-label={item.imageUrl ? item.title : undefined}
                >
                  {!item.imageUrl && "No photo added"}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5f83aa]">
                        Added {formatDate(item.addedAt)}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-[#6a7f95]">
                        From {getStoreName(item.productUrl)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e6f0fb] px-3 py-1 text-xs font-semibold text-[#36516b]">
                      {item.status}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-[#52677d]">
                      {item.notes}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#172033] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#284b78]"
                    >
                      Buy / view item
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
