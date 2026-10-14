// X (Twitter) embed iframes open the original post on any tap via
// window.open from inside the iframe. Sandbox them (no allow-popups, no
// top navigation) so taps stay inside Aelixto — same idea as Spotify/Pinterest.
// The header platform icon remains the explicit "open original" control.
const SANDBOX = "allow-scripts allow-same-origin allow-presentation";

function isXFrame(el: Element): el is HTMLIFrameElement {
  if (el.tagName !== "IFRAME") return false;
  const src = el.getAttribute("src") || "";
  return /platform\.twitter\.com\/embed|platform\.x\.com\/embed/i.test(src);
}

function lock(iframe: HTMLIFrameElement) {
  if (iframe.getAttribute("sandbox") === SANDBOX) return;
  iframe.setAttribute("sandbox", SANDBOX);
  // Sandbox only applies on the next navigation — reload once.
  const src = iframe.getAttribute("src");
  if (src) iframe.setAttribute("src", src);
}

export function installXEmbedSandbox() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  const scan = (node: Node) => {
    if (!(node instanceof Element)) return;
    if (isXFrame(node)) lock(node);
    node.querySelectorAll?.("iframe").forEach((f) => { if (isXFrame(f)) lock(f); });
  };
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes" && r.target instanceof Element && isXFrame(r.target)) {
        lock(r.target as HTMLIFrameElement);
      }
      r.addedNodes.forEach(scan);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  scan(document.documentElement);
}
