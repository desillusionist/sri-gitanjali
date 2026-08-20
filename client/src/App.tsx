/** Паломнический свиток: маршруты оставляют библиотеку и лист песни главным путём чтения. */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { SongLibraryProvider } from "./contexts/SongLibraryContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import SongPage from "./pages/SongPage";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
          <SongLibraryProvider>
            <Router />
            <Toaster richColors position="bottom-right" />
          </SongLibraryProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
