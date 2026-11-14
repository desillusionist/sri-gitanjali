import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";
import { loadWordForWord } from "./lib/wordForWordLoader";
import { initTheme } from "./lib/theme";
import { installTranslationGuard } from "./lib/translationGuard";
import { consumeSignInRedirect, verifySession } from "./lib/admin/session";
import { initDrafts } from "./lib/admin/drafts";

installTranslationGuard();
consumeSignInRedirect();
void verifySession();
void initDrafts();
initTheme();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" }).catch(() => {
      // Offline support is progressive enhancement; the library remains usable online.
    });
  });
}

// Fetch the word-for-word data once the page is idle, so a song opens with its
// tooltips ready (and the data is cached for offline use).
// Waiting for the service worker first lets it keep a copy of the data.
window.addEventListener("load", () => {
  const prefetch = () => void loadWordForWord().catch(() => undefined);
  const whenIdle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(prefetch, { timeout: 5000 }) : setTimeout(prefetch, 2000));
  const serviceWorkerReady = "serviceWorker" in navigator ? navigator.serviceWorker.ready : Promise.resolve();
  void Promise.race([serviceWorkerReady, new Promise((resolve) => setTimeout(resolve, 5000))]).then(whenIdle);
});

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
