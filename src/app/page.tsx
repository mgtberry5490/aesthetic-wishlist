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
  getPriorityOption,
  mergeWishlistItems,
  parseWishlistData,
  priorityOptions,
  statusOptions,
  type WishlistItem,
  type WishPriority,
  type WishStatus,
} from "@/lib/wishlist-html";
import { getSupabaseClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

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
  priority: 1 as WishPriority,
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

function itemFromDatabase(row: {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  notes: string;
  status: WishStatus;
  priority: WishPriority | null;
  added_at: string;
}): WishlistItem {
  return {
    id: row.id,
    title: row.title,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    notes: row.notes,
    status: row.status,
    ...(row.priority === null ? {} : { priority: row.priority }),
    addedAt: row.added_at,
  };
}

function itemForDatabase(item: WishlistItem, wishlistId: string) {
  return {
    id: item.id,
    wishlist_id: wishlistId,
    title: item.title,
    product_url: item.productUrl,
    image_url: item.imageUrl,
    notes: item.notes,
    status: item.status,
    priority: item.priority ?? null,
    added_at: item.addedAt,
  };
}

function PriorityStars({ priority }: { priority: WishPriority }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {priorityOptions.map(({ value }) => (
        <svg
          key={value}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={value <= priority ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[#b17a25]"
        >
          <path d="m12 3 2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.34l-5.62 2.96 1.07-6.27L2.9 9.6l6.3-.9L12 3Z" />
        </svg>
      ))}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: WishPriority }) {
  const option = getPriorityOption(priority);

  return (
    <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-[#fff8e8] px-3 py-2 text-xs font-semibold text-[#825a20]">
      <PriorityStars priority={option.value} />
      <span className="sr-only">{option.value} of 3 stars: </span>
      <span>{option.label}</span>
    </p>
  );
}

export default function Home() {
  const supabase = getSupabaseClient();
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
  const [cloudItems, setCloudItems] = useState<WishlistItem[]>([]);
  const [liveShareItems, setLiveShareItems] = useState<
    { token: string; items: WishlistItem[]; reservedIds: Set<string> } | null
  >(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [loadedShareToken, setLoadedShareToken] = useState<string | null>(null);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [accountMessage, setAccountMessage] = useState("");
  const [isSendingSignIn, setIsSendingSignIn] = useState(false);
  const [isReserving, setIsReserving] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [itemActionMessage, setItemActionMessage] = useState("");
  const localShareItems = useMemo(() => decodeShareItems(shareSnapshot), [shareSnapshot]);
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
  const isSharedView = Boolean(shareSnapshot);
  const isCloudAccount = Boolean(supabase && session);
  const items = isCloudAccount ? cloudItems : draftItems ?? savedItems;
  const shareItems =
    localShareItems ??
    (liveShareItems?.token === shareSnapshot ? liveShareItems.items : null);
  const isLoadingLiveShare = Boolean(
    supabase &&
      authReady &&
      shareSnapshot &&
      !localShareItems &&
      loadedShareToken !== shareSnapshot,
  );
  const editingItem = items.find((item) => item.id === editingItemId);
  const isBrowserReady = browserReadySnapshot === "ready";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }

        if (error) {
          setAccountMessage(`Could not restore your sign-in: ${error.message}`);
        }
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (active) {
          setAccountMessage(
            error instanceof Error
              ? `Could not restore your sign-in: ${error.message}`
              : "Could not restore your sign-in.",
          );
          setAuthReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setAccountMessage("");
      if (!nextSession) {
        setWishlistId(null);
        setShareToken(null);
        setCloudItems([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isBrowserReady || isSharedView || isCloudAccount) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [isBrowserReady, items, isSharedView, isCloudAccount]);

  useEffect(() => {
    if (!supabase || !authReady || !session) {
      return;
    }

    let active = true;
    const loadWishlist = async () => {
      const { data: existingWishlist, error: wishlistError } = await supabase
        .from("wishlists")
        .select("id, share_token")
        .maybeSingle();

      if (wishlistError) {
        if (active) {
          setAccountMessage(`Could not load your wishlist: ${wishlistError.message}`);
        }
        return;
      }

      let wishlist = existingWishlist;
      if (!wishlist) {
        const { data: newWishlist, error: createError } = await supabase
          .from("wishlists")
          .insert({ owner_id: session.user.id })
          .select("id, share_token")
          .single();

        if (createError) {
          if (active) {
            setAccountMessage(`Could not create your wishlist: ${createError.message}`);
          }
          return;
        }
        wishlist = newWishlist;
      }

      const { data: rows, error: itemsError } = await supabase
        .from("wishlist_items")
        .select("id, title, product_url, image_url, notes, status, priority, added_at")
        .eq("wishlist_id", wishlist.id)
        .order("added_at", { ascending: false });

      if (!active) {
        return;
      }
      if (itemsError) {
        setAccountMessage(`Could not load your saved items: ${itemsError.message}`);
        return;
      }

      setWishlistId(wishlist.id);
      setShareToken(wishlist.share_token);
      setCloudItems((rows ?? []).map(itemFromDatabase));
      setAccountMessage("");
    };

    void loadWishlist().catch((error: unknown) => {
      if (active) {
        setAccountMessage(
          error instanceof Error
            ? `Could not load your wishlist: ${error.message}`
            : "Could not load your wishlist.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [supabase, authReady, session]);

  useEffect(() => {
    if (!supabase || !authReady || !shareSnapshot || localShareItems) {
      return;
    }

    let active = true;
    const loadSharedWishlist = async () => {
      try {
        const { data, error } = await supabase.rpc("get_shared_wishlist", {
          p_share_token: shareSnapshot,
        });
        if (!active) {
          return;
        }

        if (error) {
          setItemActionMessage(`Could not load this shared list: ${error.message}`);
          setLoadedShareToken(shareSnapshot);
          return;
        }

        if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
          setItemActionMessage("This live wishlist could not be found.");
          setLoadedShareToken(shareSnapshot);
          return;
        }

        const sharedRows = data.items as Array<Record<string, unknown>>;
        const wishlistItems = sharedRows.map((row) => {
          const item = { ...row };
          delete item.reserved;
          return item;
        });
        const parsedItems = parseWishlistData(
          JSON.stringify({
            format: "aesthetic-wishlist",
            version: 1,
            items: wishlistItems,
          }),
        );
        const reservedIds = new Set(
          sharedRows.filter((item) => item.reserved === true).map((item) => String(item.id)),
        );
        setLiveShareItems({ token: shareSnapshot, items: parsedItems, reservedIds });
        setLoadedShareToken(shareSnapshot);
        setItemActionMessage("");
      } catch (error: unknown) {
        if (active) {
          setItemActionMessage(
            error instanceof Error ? `Could not load this shared list: ${error.message}` : "Could not load this shared list.",
          );
          setLoadedShareToken(shareSnapshot);
        }
      }
    };

    void loadSharedWishlist();
    const refreshInterval = window.setInterval(() => {
      void loadSharedWishlist();
    }, 30_000);
    window.addEventListener("focus", loadSharedWishlist);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", loadSharedWishlist);
    };
  }, [supabase, authReady, shareSnapshot, localShareItems]);

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

  const isOwnerShare = Boolean(session && shareToken && shareSnapshot === shareToken);
  const visibleItems = isSharedView ? shareItems ?? [] : items;
  const shareLink = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const shareValue =
      isCloudAccount && shareToken ? shareToken : encodeShareItems(items);
    return `${window.location.origin}${window.location.pathname}?share=${shareValue}`;
  }, [items, isCloudAccount, shareToken]);

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
      priority: getPriorityOption(item.priority).value,
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

  const saveCloudItem = async (item: WishlistItem) => {
    if (!supabase) {
      setItemActionMessage("Account sync is not configured.");
      return false;
    }
    if (!wishlistId) {
      setItemActionMessage("Your account list is still loading. Please try again.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("wishlist_items")
        .upsert(itemForDatabase(item, wishlistId));

      if (error) {
        setItemActionMessage(`Could not save this item: ${error.message}`);
        return false;
      }
    } catch (error) {
      setItemActionMessage(
        error instanceof Error ? `Could not save this item: ${error.message}` : "Could not save this item.",
      );
      return false;
    }

    setCloudItems((currentItems) => {
      const exists = currentItems.some((currentItem) => currentItem.id === item.id);
      return exists
        ? currentItems.map((currentItem) => currentItem.id === item.id ? item : currentItem)
        : [item, ...currentItems];
    });
    setItemActionMessage("");
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const details = {
      title: form.title.trim(),
      productUrl: form.productUrl.trim(),
      imageUrl: form.imageUrl.trim(),
      notes: form.notes.trim(),
      status: form.status,
      priority: form.priority,
    };

    if (editingItemId !== null) {
      const updatedItem = items.find((item) => item.id === editingItemId);
      if (!updatedItem) {
        return;
      }

      const nextItem = { ...updatedItem, ...details };
      if (isCloudAccount) {
        if (!(await saveCloudItem(nextItem))) {
          return;
        }
      } else {
        setDraftItems((currentItems) =>
          (currentItems ?? items).map((item) => item.id === editingItemId ? nextItem : item),
        );
      }
    } else {
      const newItem: WishlistItem = {
        ...details,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
      };

      if (isCloudAccount) {
        if (!(await saveCloudItem(newItem))) {
          return;
        }
      } else {
        setDraftItems((currentItems) => [newItem, ...(currentItems ?? items)]);
      }
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

  const updateStatus = async (id: string, status: WishStatus) => {
    setOpenItemMenuId(null);
    const item = items.find((currentItem) => currentItem.id === id);
    if (!item) {
      return;
    }
    const nextItem = { ...item, status };
    if (isCloudAccount) {
      await saveCloudItem(nextItem);
    } else {
      setDraftItems((currentItems) =>
        (currentItems ?? items).map((currentItem) => currentItem.id === id ? nextItem : currentItem),
      );
    }

    if (id === editingItemId) {
      setForm((currentForm) => ({ ...currentForm, status }));
    }
  };

  const removeItem = async (id: string) => {
    setOpenItemMenuId(null);
    if (isCloudAccount && supabase) {
      try {
        const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
        if (error) {
          setItemActionMessage(`Could not remove this item: ${error.message}`);
          return;
        }
      } catch (error) {
        setItemActionMessage(
          error instanceof Error ? `Could not remove this item: ${error.message}` : "Could not remove this item.",
        );
        return;
      }
      setCloudItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } else {
      setDraftItems((currentItems) => (currentItems ?? items).filter((item) => item.id !== id));
    }

    if (id === editingItemId) {
      resetForm();
    }
  };

  const authenticateWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAccountMessage("Add the Supabase environment variables to enable account sign-in.");
      return;
    }

    setIsSendingSignIn(true);
    setAccountMessage("");
    try {
      if (authMode === "sign_up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setAccountMessage(`Could not create your account: ${error.message}`);
        } else if (!data.session) {
          setAccountMessage(
            "Email confirmation is enabled in Supabase. Turn off Confirm email under Authentication → Providers → Email to use password sign-up without sending email.",
          );
        } else {
          setAccountMessage("Account created. You are signed in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        setAccountMessage(
          error ? `Could not sign in: ${error.message}` : "You are signed in.",
        );
      }
    } catch (error) {
      setAccountMessage(
        error instanceof Error
          ? `Could not ${authMode === "sign_up" ? "create your account" : "sign in"}: ${error.message}`
          : `Could not ${authMode === "sign_up" ? "create your account" : "sign in"}.`,
      );
    } finally {
      setIsSendingSignIn(false);
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAccountMessage(`Could not sign out: ${error.message}`);
      } else {
        setAccountMessage("You are signed out.");
      }
    } catch (error) {
      setAccountMessage(
        error instanceof Error ? `Could not sign out: ${error.message}` : "Could not sign out.",
      );
    }
  };

  const markAsBought = async (itemId: string) => {
    if (!supabase || !shareSnapshot || isOwnerShare) {
      return;
    }
    setIsReserving(itemId);
    try {
      const { data, error } = await supabase.rpc("reserve_wishlist_item", {
        p_share_token: shareSnapshot,
        p_item_id: itemId,
      });
      if (error) {
        setItemActionMessage(`Could not mark this item as bought: ${error.message}`);
        return;
      }
      if (data !== true) {
        setItemActionMessage("Someone has already marked this item as bought.");
      }

      const { data: refreshed, error: refreshError } = await supabase.rpc(
        "get_shared_wishlist",
        { p_share_token: shareSnapshot },
      );
      if (refreshError) {
        setItemActionMessage(`Could not refresh the shared list: ${refreshError.message}`);
        return;
      }
      if (
        refreshed &&
        typeof refreshed === "object" &&
        "items" in refreshed &&
        Array.isArray(refreshed.items)
      ) {
        const reservedRows = refreshed.items as Array<Record<string, unknown>>;
        setLiveShareItems((current) =>
          current
            ? {
                ...current,
                reservedIds: new Set(
                  reservedRows
                    .filter((row) => row.reserved === true)
                    .map((row) => String(row.id)),
                ),
              }
            : current,
        );
      }
      if (data === true) {
        setItemActionMessage("Marked as bought. Thank you for helping keep the gift a surprise!");
      }
    } catch (error) {
      setItemActionMessage(
        error instanceof Error
          ? `Could not mark this item as bought: ${error.message}`
          : "Could not mark this item as bought.",
      );
    } finally {
      setIsReserving(null);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setAccountMessage("Could not copy the share link. Please try again.");
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
      if (isCloudAccount && (!supabase || !wishlistId)) {
        throw new Error("Your account list is still loading. Please import again in a moment.");
      }
      const currentItems = isCloudAccount
        ? cloudItems
        : parseStoredWishlistItems(window.localStorage.getItem(storageKey) ?? "");
      const mergedItems = mergeWishlistItems(currentItems, importedItems);
      const addedCount = mergedItems.length - currentItems.length;
      const skippedCount = importedItems.length - addedCount;

      if (isCloudAccount && supabase && wishlistId) {
        const additions = mergedItems.filter(
          (item) => !currentItems.some((currentItem) => currentItem.id === item.id),
        );
        if (additions.length > 0) {
          const { error } = await supabase
            .from("wishlist_items")
            .upsert(additions.map((item) => itemForDatabase(item, wishlistId)));
          if (error) {
            throw new Error(`Could not import items to your account: ${error.message}`);
          }
        }
        setCloudItems(mergedItems);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(mergedItems));
        setDraftItems(mergedItems);
      }
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

  const importThisDevice = async () => {
    if (!supabase || !wishlistId || !isCloudAccount) {
      return;
    }

    setIsImporting(true);
    setFileMessage("");
    try {
      const additions = savedItems.filter(
        (item) => !cloudItems.some((cloudItem) => cloudItem.id === item.id),
      );
      if (additions.length === 0) {
        setFileMessage("Your account list already has everything saved on this device.");
        return;
      }

      const { error } = await supabase
        .from("wishlist_items")
        .upsert(additions.map((item) => itemForDatabase(item, wishlistId)));
      if (error) {
        setFileMessage(`Could not copy this device's list: ${error.message}`);
        return;
      }

      setCloudItems((currentItems) => mergeWishlistItems(currentItems, additions));
      setFileMessage(`Copied ${additions.length} items from this device to your account.`);
    } catch (error) {
      setFileMessage(
        error instanceof Error
          ? `Could not copy this device's list: ${error.message}`
          : "Could not copy this device's list.",
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
              family asks what to get you, send them a live list that updates as gifts are bought.
            </p>
            {!isSharedView && (
              <div className="mt-6 rounded-[1.5rem] border border-white/80 bg-[#f8fbff]/85 p-5 shadow-sm shadow-[#476587]/10">
                {!supabase ? (
                  <p className="text-sm leading-6 text-[#52677d]">
                    Account sync is not configured yet. Add the Supabase URL and
                    anon key from <code>.env.local</code> after setting up the
                    project to enable sign-in and live lists.
                  </p>
                ) : !authReady ? (
                  <p className="text-sm text-[#52677d]">Checking your account...</p>
                ) : session ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[#52677d]">
                      Signed in as <span className="font-semibold">{session.user.email}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="rounded-full border border-[#bdd3eb] bg-white px-4 py-2 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff]"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-[#344b63]">
                        {authMode === "sign_up" ? "Create your account" : "Welcome back"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#6a7f95]">
                        {authMode === "sign_up"
                          ? "Save your list securely and pick up on any device."
                          : "Sign in to pick up where you left off."}
                      </p>
                    </div>
                    <form
                      onSubmit={authenticateWithPassword}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                    <label className="grid gap-2 text-sm font-semibold text-[#344b63]">
                      Email
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 font-normal outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#344b63]">
                      Password
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        className="rounded-2xl border border-[#c9dcef] bg-white px-4 py-3 font-normal outline-none transition focus:border-[#5b8cc5] focus:ring-4 focus:ring-[#bcdcff]/40"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSendingSignIn}
                      className="rounded-full bg-[#5b8cc5] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#5b8cc5]/20 transition hover:-translate-y-0.5 hover:bg-[#4f7fb5] disabled:opacity-50 sm:col-span-2"
                    >
                      {isSendingSignIn
                        ? "Please wait..."
                        : authMode === "sign_up"
                          ? "Create account"
                          : "Sign in"}
                    </button>
                    <button
                      type="button"
                      disabled={isSendingSignIn}
                      onClick={() => {
                        setAuthMode((mode) => mode === "sign_in" ? "sign_up" : "sign_in");
                        setAccountMessage("");
                      }}
                      className="text-sm font-semibold text-[#37618f] underline-offset-4 hover:underline sm:col-span-2"
                    >
                      {authMode === "sign_up"
                        ? "Already have an account? Sign in"
                        : "New here? Create an account"}
                    </button>
                    </form>
                  </>
                )}
                <p role="status" className="mt-3 text-sm leading-6 text-[#37618f]">
                  {accountMessage}
                </p>
                {session && (
                  <p className="mt-2 text-xs leading-5 text-[#52677d]">
                    Your account list syncs across devices. Gift reservations are
                    hidden from your signed-in owner view. You stay signed in on
                    this device until you sign out.
                  </p>
                )}
                {!session && supabase && authReady && (
                  <p className="mt-2 text-xs leading-5 text-[#52677d]">
                    Your password is stored securely by Supabase. Your sign-in
                    stays remembered on this device until you sign out.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-[1.5rem] border border-white/80 bg-[#f8fbff]/90 p-5 shadow-inner shadow-[#b9d4f2]/30 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#5f83aa]">
                {isSharedView ? "Family mode" : "Your sharing link"}
              </p>
              <span className="rounded-full bg-[#e6f0fb] px-3 py-1 text-xs font-semibold text-[#36516b]">
                {isSharedView ? "Live list" : isCloudAccount ? "Synced" : "On this device"}
              </span>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight">{visibleItems.length}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7f95]">
              {visibleItems.length === 1 ? "saved find" : "saved finds"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#52677d]">
              {isSharedView
                ? "Browse the list and mark a gift bought to help avoid duplicates."
                : isCloudAccount
                  ? "Your live list stays current. Guests can mark gifts bought without revealing who did it."
                  : "Sign in to create a live list. Snapshot sharing is still available on this device."}
            </p>
            {isSharedView && isLoadingLiveShare && (
              <p className="mt-3 text-sm text-[#52677d]">Loading the latest list...</p>
            )}
            {!isSharedView && (
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={copyShareLink}
                  disabled={isCloudAccount && !shareToken}
                  className="w-full rounded-full bg-[#172033] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#172033]/20 transition hover:-translate-y-0.5 hover:bg-[#284b78] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {shareCopied
                    ? "Copied link"
                    : isCloudAccount
                      ? "Copy live family link"
                      : "Copy snapshot share link"}
                </button>
                <div className="grid grid-cols-1 gap-3">
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
                  {isCloudAccount
                    ? "Your live link stays up to date. Guests can mark gifts bought without revealing who."
                    : "This link is a snapshot for now. Sign in to create a live list guests can update."}
                </p>
                {isCloudAccount && (
                  <button
                    type="button"
                    onClick={() => void importThisDevice()}
                    disabled={!wishlistId || isImporting}
                    className="rounded-full border border-[#bdd3eb] bg-white px-4 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:opacity-50"
                  >
                    Copy this device&apos;s list to my account
                  </button>
                )}
                <p role="status" className="text-sm leading-6 text-[#37618f]">
                  {fileMessage}
                </p>
              </div>
            )}
          </div>
        </header>

        {!isSharedView && (
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
                <fieldset>
                  <legend className="text-sm font-medium text-[#344b63]">
                    How much do you love it?
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {priorityOptions.map((option) => (
                      <label key={option.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="priority"
                          value={option.value}
                          checked={form.priority === option.value}
                          onChange={() => setForm({ ...form, priority: option.value })}
                          aria-label={`${option.value} of 3 stars: ${option.label}`}
                          className="peer sr-only"
                        />
                        <span className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#c9dcef] bg-white px-3 py-3 text-center text-xs font-semibold text-[#52677d] transition hover:bg-[#fff8e8] peer-checked:border-[#b17a25] peer-checked:bg-[#fff8e8] peer-checked:text-[#825a20] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5b8cc5]">
                          <PriorityStars priority={option.value} />
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
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
                  <PriorityBadge priority={form.priority} />
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
                  [
                    "3",
                    "Share it",
                    "Send the live link so family can browse and mark gifts bought.",
                  ],
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
                {isSharedView ? "Shared birthday list" : "Your saved finds"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Wishlist board</h2>
            </div>
            {isSharedView && (
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
          {isSharedView && supabase && !authReady && (
            <p className="rounded-2xl bg-white/70 p-5 text-sm leading-6 text-[#52677d]">
              Checking for the latest list...
            </p>
          )}
          {isSharedView && authReady && !isLoadingLiveShare && visibleItems.length === 0 && (
            <p className="rounded-2xl bg-white/70 p-5 text-sm leading-6 text-[#52677d]">
              {itemActionMessage ||
                (!supabase && !localShareItems
                  ? "This live list needs the account service configured before it can load."
                  : "This wishlist is empty or could not be found.")}
            </p>
          )}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-[#f8fbff] shadow-xl shadow-[#476587]/10 transition hover:-translate-y-1"
              >
                {!isSharedView && (
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

                  <PriorityBadge priority={item.priority} />
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
                      {liveShareItems?.reservedIds.has(item.id) ? "View item" : "Buy / view item"}
                    </a>
                    {isSharedView &&
                      liveShareItems &&
                      (!session || (shareToken !== null && !isOwnerShare)) && (
                      <button
                        type="button"
                        disabled={
                          liveShareItems.reservedIds.has(item.id) || isReserving === item.id
                        }
                        onClick={() => void markAsBought(item.id)}
                        className="rounded-full border border-[#bdd3eb] bg-white px-5 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {liveShareItems.reservedIds.has(item.id)
                          ? "Already marked bought"
                          : isReserving === item.id
                            ? "Saving..."
                            : "Mark as bought"}
                      </button>
                    )}
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
