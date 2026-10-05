import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/error-boundary";

const container = document.getElementById("root");

if (!container) {
  // Nothing to mount into, so say so rather than throwing on null.
  document.body.textContent =
    "FontyView could not start: no element with the id 'root' was found.";
} else {
  createRoot(container).render(
    <StrictMode>
      {/* The outermost boundary, so a failure in the shell or the header
          leaves a readable page instead of a blank document. */}
      <ErrorBoundary label="FontyView">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
