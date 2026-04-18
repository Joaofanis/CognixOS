import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import SecurityErrorBoundary from "./components/SecurityErrorBoundary.tsx";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <SecurityErrorBoundary>
    <App />
    <SpeedInsights />
  </SecurityErrorBoundary>
);
