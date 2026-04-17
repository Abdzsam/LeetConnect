import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sidebar } from "./sidebar/Sidebar.js";
import { onSlugChange, getCurrentSlug } from "./detector.js";
import "../styles/globals.css";

function App({ shadowRoot }: { shadowRoot: ShadowRoot }) {
  const [slug, setSlug] = useState<string | null>(getCurrentSlug());

  useEffect(() => {
    const unsub = onSlugChange((newSlug) => {
      setSlug(newSlug);
    });
    return unsub;
  }, []);

  return <Sidebar slug={slug} shadowRoot={shadowRoot} />;
}

function mount() {
  // Prevent double-injection
  if (document.getElementById("leetconnect-host")) return;

  const host = document.createElement("div");
  host.id = "leetconnect-host";
  host.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject Tailwind styles into shadow DOM
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("assets/content/index.css");
  shadow.appendChild(styleLink);

  const container = document.createElement("div");
  container.style.cssText = `
    display: flex;
    justify-content: flex-end;
    height: 100%;
    pointer-events: auto;
  `;
  shadow.appendChild(container);

  createRoot(container).render(
    <StrictMode>
      <App shadowRoot={shadow} />
    </StrictMode>
  );
}

// Mount immediately if DOM is ready, otherwise wait
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
