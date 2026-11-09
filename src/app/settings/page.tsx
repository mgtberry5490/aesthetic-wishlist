"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
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
import { getSupabaseClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

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
  const gridColumns = Number(gridColumnsSnapshot) as GridColumns;
  const { mode, accent } = parseAppearance(appearanceSnapshot);
  const selectedAccent =
    accentOptions.find((option) => option.value === accent) ?? accentOptions[0];
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        router.replace("/");
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
        if (!data.session) {
          router.replace("/");
          return;
        }

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
  }, [router, supabase]);

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

        {!supabase ? (
          <div className="theme-surface rounded-2xl border border-white/70 bg-white/70 p-5">
            <p role="alert" className="text-sm leading-6 text-[#8b4a58]">
              Account sync is not configured on this device.
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold underline">
              Return to Wishful
            </Link>
          </div>
        ) : !authReady ? (
          <p className="theme-surface rounded-2xl border border-white/70 bg-white/70 p-5 text-sm text-[#52677d]">
            Checking your account...
          </p>
        ) : authError ? (
          <div className="theme-surface rounded-2xl border border-white/70 bg-white/70 p-5">
            <p role="alert" className="text-sm leading-6 text-[#8b4a58]">{authError}</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold underline">
              Return to Wishful
            </Link>
          </div>
        ) : session ? (
          <>
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
                Choose how many cards fit across on wide screens. Smaller screens
                automatically use fewer columns.
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

            <section className="theme-surface flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/70 bg-[#f8fbff]/90 p-6 shadow-xl shadow-[#476587]/10 sm:p-8">
              <div>
                <h2 className="text-xl font-semibold">Account</h2>
                <p className="mt-2 text-sm text-[#52677d]">
                  Sign out of Wishful on this device.
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
          </>
        ) : null}
      </div>
    </main>
  );
}
