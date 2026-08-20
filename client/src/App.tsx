/** Паломнический свиток: маршруты оставляют библиотеку и лист песни главным путём чтения. */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { SongLibraryProvider } from "./contexts/SongLibraryContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import Home from "./pages/Home";
import FavoritesPage from "./pages/FavoritesPage";
import NotFound from "./pages/NotFound";
import SongPage from "./pages/SongPage";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/song/:id" component={SongPage} />
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
              <Router />
              <Toaster richColors position="bottom-right" />
            </SongLibraryProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
