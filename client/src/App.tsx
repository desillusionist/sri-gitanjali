/** Паломнический свиток: маршруты оставляют библиотеку и лист песни главным путём чтения. */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { SongLibraryProvider } from "./contexts/SongLibraryContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { PlayerDock } from "./components/PlayerDock";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import Home from "./pages/Home";
import FavoritesPage from "./pages/FavoritesPage";
import NotFound from "./pages/NotFound";
import SongPage from "./pages/SongPage";
import AuthorPage from "./pages/AuthorPage";
import VaisnavasPage from "./pages/VaisnavasPage";
import PortraitCropsPage from "./pages/PortraitCropsPage";
import AdminPage from "./pages/AdminPage";
import PlaylistPage from "./pages/PlaylistPage";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { useEffect, useRef } from "react";

/** New pages open at the top; Back and Forward keep the browser's own scroll restoration. */
function ScrollToTopOnNavigate() {
  const [location] = useLocation();
  const lastHistoryStepRef = useRef(0);
  useEffect(() => {
    const markHistoryStep = () => { lastHistoryStepRef.current = performance.now(); };
    window.addEventListener("popstate", markHistoryStep);
    return () => window.removeEventListener("popstate", markHistoryStep);
  }, []);
  useEffect(() => {
    const isHistoryStep = performance.now() - lastHistoryStepRef.current < 300;
    if (!isHistoryStep && location !== "/") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

// "/sri-gitanjali" on GitHub Pages, "" everywhere else.
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/playlist" component={PlaylistPage} />
      <Route path="/song/:id" component={SongPage} />
      <Route path="/author/:id" component={AuthorPage} />
      <Route path="/vaisnavas" component={VaisnavasPage} />
      <Route path="/portraits" component={PortraitCropsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <LanguageProvider>
            <SongLibraryProvider>
              <WouterRouter base={ROUTER_BASE}>
                <PlayerProvider>
                  <ScrollToTopOnNavigate />
                  <Router />
                  <PlayerDock />
                </PlayerProvider>
              </WouterRouter>
              <Toaster richColors position="bottom-right" />
            </SongLibraryProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
