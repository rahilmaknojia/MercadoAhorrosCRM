"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// A slim bar across the top of the window while a client-side navigation is in flight.
//
// loading.tsx skeletons cover moving to a new page, but not a navigation that only changes the
// query string (search, filters, sort, paging, running a report) — the current page stays mounted
// while the server renders the new one, and the only feedback would be the browser tab spinner.
// This bar covers every navigation: it starts on an internal link click, a GET <form> submit, or
// a useProgressRouter() push, and finishes when the URL (pathname + search) actually changes.

const START_EVENT = "nav-progress:start";
const SHOW_DELAY_MS = 150; // fast navigations finish before the bar would flash
const SAFETY_TIMEOUT_MS = 30_000; // never leave a stuck bar (e.g. a navigation that was abandoned)

/** Start the bar for a navigation not triggered by a link/form (e.g. router.push in code). */
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

// Loading skeletons (loading.tsx) currently on screen. With a prefetched skeleton the URL changes
// almost instantly — the real wait is while the skeleton shows — so the bar keeps running until the
// last skeleton unmounts. Module-level because on a first page load the skeleton's effect runs
// before the bar (in the layout above it) has attached its listeners.
let skeletonHolds = 0;
const HOLDS_CHANGED_EVENT = "nav-progress:holds";

/** Render inside a loading skeleton: keeps the progress bar running until the page replaces it. */
export function NavigationHold() {
  useEffect(() => {
    skeletonHolds += 1;
    window.dispatchEvent(new Event(HOLDS_CHANGED_EVENT));
    return () => {
      skeletonHolds = Math.max(0, skeletonHolds - 1);
      window.dispatchEvent(new Event(HOLDS_CHANGED_EVENT));
    };
  }, []);
  return null;
}

/** useRouter() whose push/replace also start the progress bar. */
export function useProgressRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        if (isNewUrl(args[0])) startNavigationProgress();
        router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        if (isNewUrl(args[0])) startNavigationProgress();
        router.replace(...args);
      },
    }),
    [router]
  );
}

// True when `href` points at a different same-origin page (ignoring a #hash-only change).
function isNewUrl(href: string): boolean {
  try {
    const target = new URL(href, window.location.href);
    const here = window.location;
    return (
      target.origin === here.origin &&
      (target.pathname !== here.pathname || target.search !== here.search)
    );
  } catch {
    return false;
  }
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;

  // progress: null = hidden; otherwise the bar's width in percent.
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const active = useRef(false);
  // The URL currently on screen (same shape as `url`), for spotting a real back/forward move.
  const renderedUrl = useRef(url);
  useEffect(() => {
    renderedUrl.current = url;
  }, [url]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress((p) => (p === null ? null : 100));
    timers.current.push(window.setTimeout(() => setProgress(null), 250));
  }

  // Finish when the URL changes (the navigation committed) — unless a loading skeleton is still
  // showing, in which case the page itself hasn't arrived yet; its unmount finishes the bar.
  useEffect(() => {
    if (skeletonHolds === 0) finish();
  }, [url]);

  useEffect(() => {
    function start() {
      if (active.current) return;
      active.current = true;
      clearTimers();
      timers.current.push(
        window.setTimeout(() => {
          if (!active.current) return;
          setProgress(15);
          // Creep toward 90% — we can't know the real progress, only that it's still working.
          const trickle = () => {
            setProgress((p) => (p === null ? null : Math.min(90, p + (90 - p) * 0.1)));
            timers.current.push(window.setTimeout(trickle, 300));
          };
          timers.current.push(window.setTimeout(trickle, 300));
        }, SHOW_DELAY_MS),
        window.setTimeout(() => {
          active.current = false;
          clearTimers();
          setProgress(null);
        }, SAFETY_TIMEOUT_MS)
      );
    }

    // defaultPrevented is deliberately NOT checked: next/link and next/form preventDefault() to
    // do a client-side navigation, which is exactly what we want to show progress for.
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      if (isNewUrl(a.href)) start();
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      // Only GET forms navigate; POST forms are server actions with their own pending UI.
      if (!form || form.method.toLowerCase() !== "get") return;
      if (form.target && form.target !== "_self") return;
      // The URL the submit navigates to; resubmitting the same search changes nothing.
      const target = new URL(form.action || window.location.href, window.location.href);
      target.search = "";
      new FormData(form).forEach((value, key) => {
        if (typeof value === "string") target.searchParams.append(key, value);
      });
      if (isNewUrl(target.href)) start();
    }

    // A skeleton appeared (start, e.g. a first page load or a navigation we didn't see begin) or
    // the last one went away (the page has rendered: finish).
    function onHoldsChanged() {
      if (skeletonHolds > 0) start();
      else finish();
    }

    // Back/forward: the browser URL has already moved; show progress until the page catches up.
    function onPopState() {
      if (`${window.location.pathname}?${window.location.search.slice(1)}` !== renderedUrl.current) start();
    }

    // Capture phase: see the event before any handler can stop its propagation.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(START_EVENT, start);
    window.addEventListener("popstate", onPopState);
    window.addEventListener(HOLDS_CHANGED_EVENT, onHoldsChanged);
    // A skeleton that mounted before these listeners (first page load) still gets its bar.
    if (skeletonHolds > 0) start();
    return () => {
      window.removeEventListener(HOLDS_CHANGED_EVENT, onHoldsChanged);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(START_EVENT, start);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  if (progress === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Mount once in the app shell. */
export function NavigationProgress() {
  // useSearchParams needs a Suspense boundary so it doesn't opt the whole layout out of static rendering.
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
