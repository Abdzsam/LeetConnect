import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup.js";

const root = document.getElementById("popup-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  );
}
