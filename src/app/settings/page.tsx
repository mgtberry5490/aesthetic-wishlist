"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  accentOptions,
  getAppearanceSnapshot,
  getServerAppearanceSnapshot,
  parseAppearance,
  saveAppearance,
  subscribeToAppearance,
  type AccentName,
  type ThemeMode,
} from "@/lib/appearance";
import {
  getGridColumnsSnapshot,
  getServerGridColumnsSnapshot,
  gridColumnOptions,
  saveGridColumns,
  subscribeToGridColumns,
  type GridColumns,
} from "@/lib/display-preferences";
import {
  mergeWishlistItems,
  parseWishlistData,
  type WishlistItem,
} from "@/lib/wishlist-html";
import { getSupabaseClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const wishlistStorageKey = "aesthetic-wishlist-items";
const wishlistStorageChangeEvent = "wishlist-items-change";

type WishlistRow = {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  notes: string;
  status: string;
  priority: number | null;
  added_at: string;
};

function wishlistItemsFromRows(rows: WishlistRow[]) {
  return parseWishlistData(JSON.stringify({
    format: "aesthetic-wishlist",
    version: 1,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      productUrl: row.product_url,
      imageUrl: row.image_url,
      notes: row.notes,
      status: row.status,
      ...(row.priority === null ? {} : { priority: row.priority }),
      addedAt: row.added_at,
    })),
  }));
}

function wishlistItemsForDatabase(items: WishlistItem[], wishlistId: string) {
  return items.map((item) => ({
    id: item.id,
    wishlist_id: wishlistId,
    title: item.title,
    product_url: item.productUrl,
    image_url: item.imageUrl,
    notes: item.notes,
    status: item.status,
    priority: item.priority ?? null,
    added_at: item.addedAt,
  }));
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const appearanceSnapshot = useSyncExternalStore(
    subscribeToAppearance,
    getAppearanceSnapshot,
    getServerAppearanceSnapshot,
  );
  const gridColumnsSnapshot = useSyncExternalStore(
    subscribeToGridColumns,
    getGridColumnsSnapshot,
    getServerGridColumnsSnapshot,
  );
  const gridColumns =
    gridColumnsSnapshot === "default"
      ? null
      : Number(gridColumnsSnapshot) as GridColumns;
  const { mode, accent } = parseAppearance(appearanceSnapshot);
  const selectedAccent =
    accentOptions.find((option) => option.value === accent) ?? accentOptions[0];
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [accountItems, setAccountItems] = useState<WishlistItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setAuthError("");
      setAuthReady(true);
      if (event === "SIGNED_OUT") {
        setWishlistId(null);
        setAccountItems([]);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }

        if (error) {
          setAuthError(`Could not check your sign-in: ${error.message}`);
          setAuthReady(true);
          return;
        }

        setAuthError("");
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setAuthError(
          error instanceof Error
            ? `Could not check your sign-in: ${error.message}`
            : "Could not check your sign-in.",
        );
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !authReady || !session) {
      return;
    }

    let active = true;
    const loadAccountList = async () => {
      const { data: existingWishlist, error: wishlistError } = await supabase
        .from("wishlists")
        .select("id")
        .maybeSingle();
      if (wishlistError) throw new Error(`Could not load your wishlist: ${wishlistError.message}`);

      let id = existingWishlist?.id;
      if (!id) {
        const { data, error } = await supabase
          .from("wishlists")
          .insert({ owner_id: session.user.id })
          .select("id")
          .single();
        if (error) {
          const { data: createdByAnotherRequest, error: retryError } = await supabase
            .from("wishlists")
            .select("id")
            .maybeSingle();
          if (retryError || !createdByAnotherRequest) {
            throw new Error(`Could not create your wishlist: ${error.message}`);
          }
          id = createdByAnotherRequest.id;
        } else {
          id = data.id;
        }
      }

      const { data: rows, error: itemsError } = await supabase
        .from("wishlist_items")
        .select("id, title, product_url, image_url, notes, status, priority, added_at")
        .eq("wishlist_id", id)
        .order("added_at", { ascending: false });
      if (itemsError) throw new Error(`Could not load your saved items: ${itemsError.message}`);

      if (active) {
        setWishlistId(id);
        setAccountItems(wishlistItemsFromRows((rows ?? []) as WishlistRow[]));
      }
    };

    void loadAccountList()
      .catch((error: unknown) => {
        if (active) {
          setAuthError(
            error instanceof Error ? error.message : "Could not load your wishlist.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, session, supabase]);

  const importHtml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setImportMessage("");
    try {
      const template = document.createElement("template");
      template.innerHTML = await file.text();
      const data = template.content.querySelector(
        'script#aesthetic-wishlist-data[type="application/json"]',
      )?.textContent;
      if (!data) throw new Error("Choose an HTML file exported from this wishlist app.");
      const incomingItems = parseWishlistData(data);
      let existingItems: WishlistItem[];

      if (session) {
        if (!supabase || !wishlistId) {
          throw new Error("Your account list is still loading. Please import again in a moment.");
        }
        existingItems = accountItems;
      } else {
        const stored = window.localStorage.getItem(wishlistStorageKey);
        if (!stored) {
          existingItems = [];
        } else {
          const parsed: unknown = JSON.parse(stored);
          if (!Array.isArray(parsed)) {
            throw new Error("The saved list on this device is invalid. Your list was not changed.");
          }
          existingItems = parseWishlistData(JSON.stringify({
            format: "aesthetic-wishlist",
            version: 1,
            items: parsed,
          }));
        }
      }

      const mergedItems = mergeWishlistItems(existingItems, incomingItems);
      const additions = mergedItems.filter(
        (item) => !existingItems.some((existingItem) => existingItem.id === item.id),
      );

      if (session && supabase && wishlistId && additions.length > 0) {
        const { error } = await supabase
          .from("wishlist_items")
          .upsert(wishlistItemsForDatabase(additions, wishlistId));
        if (error) throw new Error(`Could not import items to your account: ${error.message}`);
        setAccountItems(mergedItems);
      } else if (!session) {
        window.localStorage.setItem(wishlistStorageKey, JSON.stringify(mergedItems));
        window.dispatchEvent(new Event(wishlistStorageChangeEvent));
      }

      const skipped = incomingItems.length - additions.length;
      setImportMessage(
        `Imported ${additions.length} ${additions.length === 1 ? "item" : "items"}. ${skipped} already on your list skipped.`,
      );
    } catch (error) {
      setImportMessage(
        error instanceof Error && !(error instanceof SyntaxError)
          ? error.message
          : "Could not read this wishlist file. Your list was not changed.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const copyDeviceList = async () => {
    if (!supabase || !session || !wishlistId) {
      setImportMessage("Your account list is still loading. Please try again in a moment.");
      return;
    }

    setIsImporting(true);
    setImportMessage("");
    try {
      const stored = window.localStorage.getItem(wishlistStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) {
        throw new Error("The saved list on this device is invalid. Nothing was copied.");
      }
      const deviceItems = parseWishlistData(JSON.stringify({
        format: "aesthetic-wishlist",
        version: 1,
        items: parsed,
      }));
      const additions = deviceItems.filter(
        (item) => !accountItems.some((accountItem) => accountItem.id === item.id),
      );
      if (additions.length === 0) {
        setImportMessage("Your account list already has everything saved on this device.");
        return;
      }

      const { error } = await supabase
        .from("wishlist_items")
        .upsert(wishlistItemsForDatabase(additions, wishlistId));
      if (error) throw new Error(`Could not copy this device's list: ${error.message}`);
      setAccountItems((currentItems) => mergeWishlistItems(currentItems, additions));
      setImportMessage(`Copied ${additions.length} items from this device to your account.`);
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "Could not copy this device's list.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const updateAppearance = (nextMode: ThemeMode, nextAccent: AccentName) => {
    try {
      saveAppearance(nextMode, nextAccent);
      setSettingsMessage("");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error
          ? `Could not save your appearance preference: ${error.message}`
          : "Could not save your appearance preference.",
      );
    }
  };

  const updateGridColumns = (columns: GridColumns) => {
    try {
      saveGridColumns(columns);
      setSettingsMessage("");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error
          ? `Could not save your card layout: ${error.message}`
          : "Could not save your card layout.",
      );
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    setIsSigningOut(true);
    setSettingsMessage("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setSettingsMessage(`Could not sign out: ${error.message}`);
        return;
      }
      router.replace("/");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? `Could not sign out: ${error.message}` : "Could not sign out.",
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main
      data-color-mode={mode}
      data-accent={accent}
      style={{ "--theme-accent": selectedAccent.color } as React.CSSProperties}
      className="min-h-screen bg-[#eef6ff] px-5 py-8 text-[#172033] sm:px-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="theme-surface rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
          <Link
            href="/"
            className="theme-control inline-flex rounded-full border border-[#bdd3eb] bg-white/80 px-4 py-2 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff]"
          >
            Back to my list
          </Link>
          <p className="theme-accent-text mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-[#4f7fb5]">
            Wishful
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Settings
          </h1>
          {authReady && session && (
            <p className="mt-3 text-sm text-[#52677d]">
              Signed in as <span className="font-semibold">{session.user.email}</span>
            </p>
          )}
        </header>

        {!authReady && supabase && (
          <p className="theme-surface rounded-2xl border border-white/70 bg-white/70 p-5 text-sm text-[#52677d]">
            Checking your account...
          </p>
        )}
        {authError && (
          <p role="alert" className="theme-surface rounded-2xl border border-white/70 bg-white/70 p-5 text-sm leading-6 text-[#8b4a58]">
            {authError}
          </p>
        )}
        <section className="theme-surface rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
              <h2 className="text-xl font-semibold">Appearance</h2>
              <p className="mt-2 text-sm leading-6 text-[#52677d]">
                Choose a theme and accent color for this browser.
              </p>

              <div className="mt-7">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7f95]">
                  Theme
                </h3>
                <div className="grid max-w-sm grid-cols-2 gap-3">
                  {(["light", "dark"] as const).map((themeMode) => (
                    <button
                      key={themeMode}
                      type="button"
                      aria-pressed={mode === themeMode}
                      onClick={() => updateAppearance(themeMode, accent)}
                      className={`theme-control theme-accent-border rounded-full border px-4 py-3 text-sm font-semibold capitalize transition ${
                        mode === themeMode
                          ? "theme-accent-bg border-[#5b8cc5] bg-[#e8f2ff] text-white"
                          : "border-[#bdd3eb] bg-white text-[#52677d] hover:bg-[#e8f2ff]"
                      }`}
                    >
                      {themeMode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7f95]">
                  Accent color
                </h3>
                <div className="flex flex-wrap gap-3">
                  {accentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`${option.label} accent`}
                      aria-pressed={accent === option.value}
                      onClick={() => updateAppearance(mode, option.value)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white shadow-sm outline-offset-2 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#172033]"
                      style={{ backgroundColor: option.color }}
                    >
                      {accent === option.value && (
                        <span className="text-sm font-bold text-white" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <p role="status" className="mt-5 min-h-5 text-sm text-[#8b4a58]">
                {settingsMessage}
              </p>
        </section>

        <section className="theme-surface rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
              <h2 className="text-xl font-semibold">Wishlist cards</h2>
              <p className="mt-2 text-sm leading-6 text-[#52677d]">
                By default, smaller screens show 2 cards across and larger
                screens show 4. Choose a number to keep that layout on every screen.
              </p>
              <fieldset className="mt-6">
                <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7f95]">
                  Cards across
                </legend>
                <div className="grid max-w-xl grid-cols-4 gap-3">
                  {gridColumnOptions.map((columns) => (
                    <button
                      key={columns}
                      type="button"
                      aria-pressed={gridColumns === columns}
                      onClick={() => updateGridColumns(columns)}
                      className={`theme-control theme-accent-border rounded-2xl border px-3 py-4 text-center transition ${
                        gridColumns === columns
                          ? "theme-accent-bg border-[#5b8cc5] text-white"
                          : "border-[#bdd3eb] bg-white text-[#52677d] hover:bg-[#e8f2ff]"
                      }`}
                    >
                      <span className="block text-lg font-semibold">{columns}</span>
                      <span className="mt-1 block text-xs">across</span>
                    </button>
                  ))}
                </div>
              </fieldset>
        </section>

        <section className="theme-surface rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
          <h2 className="text-xl font-semibold">Import or move a list</h2>
          <p className="mt-2 text-sm leading-6 text-[#52677d]">
            Import an older Wishful HTML backup, or copy this browser&apos;s list
            into your signed-in account.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="theme-control rounded-full border border-[#bdd3eb] bg-white px-4 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Import HTML"}
            </button>
            {session && (
              <button
                type="button"
                onClick={() => void copyDeviceList()}
                disabled={!wishlistId || isImporting}
                className="theme-control rounded-full border border-[#bdd3eb] bg-white px-4 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:opacity-50"
              >
                {isImporting ? "Copying..." : "Copy this device's list to my account"}
              </button>
            )}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".html,.htm,text/html"
            aria-label="Import wishlist HTML file"
            onChange={importHtml}
            className="hidden"
          />
          {session && !wishlistId && !authError && (
            <p className="mt-3 text-xs leading-5 text-[#52677d]">
              Loading your account list...
            </p>
          )}
          <p role="status" className="mt-4 min-h-5 text-sm leading-6 text-[#37618f]">
            {importMessage}
          </p>
        </section>

        {session && (
          <section className="theme-surface flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
            <div>
              <h2 className="text-xl font-semibold">Account</h2>
              <p className="mt-2 text-sm text-[#52677d]">
                Signed in as {session.user.email}. Your wishlist syncs across
                devices; gift reservations stay hidden from your owner view.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={isSigningOut}
              className="theme-control rounded-full border border-[#bdd3eb] bg-white px-5 py-3 text-sm font-semibold text-[#344b63] transition hover:bg-[#e8f2ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
