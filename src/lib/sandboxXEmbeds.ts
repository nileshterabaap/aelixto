// X (Twitter) embed iframes open the original post on any tap (window.open
// from inside the iframe). Sandbox them without allow-popups / top navigation
// so taps stay inside Aelixto. The sandbox is applied BEFORE the iframe's src
// is set, so the post loads once — no extra reload.
const SANDBOX = "allow-scripts allow-same-origin allow-presentation";
const X_EMBED = /platform\.(twitter|x)\.com\/embed/i;

function prepare(iframe: HTMLIFrameElement, src: string) {
  if (X_EMBED.test(src) && iframe.getAttribute("sandbox") !== SANDBOX) {
    iframe.setAttribute("sandbox", SANDBOX);
  }
}

let installed = false;

export function installXEmbedSandbox() {
  if (installed || typeof window === "undefined" || typeof HTMLIFrameElement === "undefined") return;
  installed = true;

  const proto = HTMLIFrameElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "src");
  if (desc?.set && desc.get) {
    Object.defineProperty(proto, "src", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(this: HTMLIFrameElement, value: string) {
        prepare(this, String(value));
        desc.set!.call(this, value);
      },
    });
  }

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (this instanceof HTMLIFrameElement && name.toLowerCase() === "src") {
      prepare(this, String(value));
    }
    return originalSetAttribute.call(this, name, value);
  };
}
