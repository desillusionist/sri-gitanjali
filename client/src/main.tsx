import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Offline support is progressive enhancement; the library remains usable online.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
