import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import SecurityErrorBoundary from "./components/SecurityErrorBoundary.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <SecurityErrorBoundary>
    <App />
  </SecurityErrorBoundary>
);
