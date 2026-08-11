import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import quoraIcon from "@/assets/platforms/quora.svg";
import blogIcon from "@/assets/platforms/articles.svg";
import externalIcon from "@/assets/platforms/external.svg";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Quora (and a few other) CDNs hotlink-block direct <img> requests from
// third-party origins. Route those through our img-proxy edge function so
// the hero thumbnail actually renders in the feed.
function proxiedImage(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    const needsProxy = /quoracdn\.net$|\.quoracdn\.net$|qph\.|licdn\.com$|\.licdn\.com$/i.test(u.hostname);
    if (!needsProxy || !SUPABASE_URL) return src;
    return `${SUPABASE_URL}/functions/v1/img-proxy?u=${encodeURIComponent(src)}`;
  } catch {
    return src;
  }
}

// Quora often returns generic error strings in the scraped body when it
// blocks the scraper. Treat those (and other obvious non-excerpts) as empty
// so the card collapses to title + image + CTA instead of showing junk.
const JUNK_EXCERPT_RE = /(something went wrong|wait a moment and try again|sign in|sign up|all related|more answers|you (must )?log ?in|enable javascript|are you a robot|access denied)/i;
function cleanExcerpt(text: string | null | undefined): string {
  if (!text) return "";
  const t = text.trim();
  if (!t) return "";
  if (JUNK_EXCERPT_RE.test(t)) return "";
  return t;
}

// --- Helpers: safe DOM parsing on reader HTML (r.jina.ai result) ---
// Safe entity decoding using DOMParser instead of innerHTML assignment
function decodeEntities(s: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(s, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function resolveUrlMaybeRelative(src: string, baseUrl: string): string {
  try { return new URL(src, baseUrl).toString(); } catch { return src; }
}

const BAD_TEXT_RE = /\b(advert|advertisement|sponsor|cookie|privacy|terms|subscribe|newsletter|editorial|policy|health\s+library|related\s+content|read\s+more)\b/i;

function isGarbagePara(t: string): boolean {
  const clean = decodeEntities(t);
  if (!clean) return true;
  if (clean.length < 60) return true;                 // too short
  if (BAD_TEXT_RE.test(clean)) return true;           // boilerplate
  return false;
}

function findArticleRoot(doc: Document): Element {
  const prefs = [
    "main article", "article", "main", "[itemprop='articleBody']",
    ".article-content", ".post-content", ".entry-content", "#content"
  ];
  for (const sel of prefs) {
    const el = doc.querySelector(sel);
    if (el) return el;
  }
  return doc.body;
}

// 1) Lead paragraph = first good <p> after the page H1 (depth-first)
function extractLeadParagraph(doc: Document): string | undefined {
  const root = findArticleRoot(doc);
  const h1 = root.querySelector("h1") || doc.querySelector("h1");
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let afterH1 = !h1; // if no h1, allow from start
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    if (el === h1) { afterH1 = true; continue; }
    if (!afterH1) continue;
    if (el.tagName.toLowerCase() !== "p") continue;

    const t = (el.textContent || "").trim();
    if (!isGarbagePara(t)) return decodeEntities(t);
  }
  // fallback: first acceptable <p> anywhere in root
  for (const p of Array.from(root.querySelectorAll("p"))) {
    const t = (p.textContent || "").trim();
    if (!isGarbagePara(t)) return decodeEntities(t);
  }
  return undefined;
}

// 2) Hero image = image near top of article; support srcset/data-src; fallback to og:image
function pickHeroImage(doc: Document, pageUrl: string): string | undefined {
  const root = findArticleRoot(doc);
  // Prefer first <figure> img
  const figureImg = root.querySelector("figure img");
  const firstImg  = figureImg || root.querySelector("img");
  if (firstImg) {
    const src =
      firstImg.getAttribute("src") ||
      firstImg.getAttribute("data-src") ||
      (firstImg.getAttribute("srcset") || "")
        .split(",")
        .map(s => s.trim().split(" ")[0])
        .find(Boolean) || "";
    if (src && !src.startsWith("data:")) {
      return resolveUrlMaybeRelative(src, pageUrl);
    }
  }
  const og = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
  return og ? resolveUrlMaybeRelative(og, pageUrl) : undefined;
}

function summarize(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  if (sentences.length <= 200) return sentences;
  return sentences.slice(0, 200).replace(/\s+\S*$/, "") + "…";
}

interface ArticleContentEmbedProps {
  data: {
    resolvedUrl: string;
    site: {
      name: string;
      domain: string;
      favicon: string;
    };
    meta: {
      title: string;
      description: string;
      image: string | null;
      publishedTime: string | null;
    };
    content: {
      html: string;
    };
  };
  postId?: string;
  platform?: string | null;
}

export const ArticleContentEmbed = ({ data, postId, platform }: ArticleContentEmbedProps) => {
  const isExternal = platform === 'external';
  const ctaLabel = isExternal ? 'Visit' : 'Continue Reading';
  // Note: the CTA anchor click bubbles up to useOriginalVisitTracker's
  // container-level click listener, which fires exactly one `original_visit`
  // event for non-playable posts (articles/external/quora). We intentionally
  // do NOT also fire `article_open` / `external_visit` here — that would
  // record two separate events for a single Continue Reading / Visit tap and
  // award the author +2 score instead of +1.
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  // Parse HTML and extract lead paragraph + hero image using DOM
  const parseContent = () => {
    // Fallback values - ALWAYS prioritize meta.image from edge function
    let excerpt = cleanExcerpt(data.meta.description);
    let heroImage = data.meta.image || null;
    
    console.log('[ArticleContentEmbed] Initial meta.image:', data.meta.image);
    
    // Try DOM-based extraction if we have HTML content
    if (data.content?.html) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.content.html, "text/html");
        
        // Extract first paragraph after H1
        const lead = extractLeadParagraph(doc);
        
        // Use lead paragraph if found, otherwise keep meta description
        if (lead) {
          const cleaned = cleanExcerpt(lead);
          if (cleaned) excerpt = summarize(cleaned);
        }
        
        // Only try to extract image from HTML if we don't have one from meta
        if (!heroImage) {
          const heroImg = pickHeroImage(doc, data.resolvedUrl);
          if (heroImg) {
            heroImage = heroImg;
          }
        }
        
        console.log('[ArticleContentEmbed] Final heroImage:', heroImage);
      } catch (err) {
        console.error('[ArticleContentEmbed] DOM parsing error:', err);
        // Keep fallback values
      }
    }
    
    return { excerpt, heroImage };
  };
  
  const { excerpt, heroImage } = parseContent();
  const displayImage = proxiedImage(heroImage);
  const isCompact = !excerpt;
  // No image on the source page → branded platform logo tile so the card
  // never renders imageless. Purely presentational; no tracking involved.
  const fallbackKind =
    platform === 'quora' || data.site?.domain?.includes('quora.com')
      ? 'quora'
      : platform === 'external'
        ? 'external'
        : 'article';
  const fallbackIcon =
    fallbackKind === 'quora' ? quoraIcon : fallbackKind === 'external' ? externalIcon : blogIcon;
  const fallbackLabel =
    fallbackKind === 'quora' ? 'Quora' : fallbackKind === 'external' ? 'Link' : 'Article';
  const fallbackGradient = `var(--thumb-gradient-${fallbackKind})`;

  return (
    <article className="rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all">
      {/* Content */}
      <div className={isCompact ? "p-4 space-y-3" : "p-5 space-y-4"}>
        {/* Title */}
        <h3 className={`${isCompact ? "text-lg" : "text-xl"} font-bold leading-tight text-foreground`}>
          {data.meta.title}
        </h3>

        {/* Thumbnail */}
        {displayImage ? (
          <div className={`relative w-full ${isCompact ? "h-40" : "h-48"} rounded-xl overflow-hidden bg-muted mx-auto`}>
            <img
              src={displayImage}
              alt={data.meta.title}
              className="w-full h-full object-cover object-center"
              loading="lazy"
              width="400"
              height={isCompact ? 160 : 192}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                // If the proxied image fails, try the raw URL as a last resort
                if (heroImage && img.src !== heroImage) {
                  img.src = heroImage;
                } else {
                  img.style.display = 'none';
                }
              }}
            />
          </div>
        ) : (
          <div
            className={`relative w-full ${isCompact ? "h-40" : "h-48"} rounded-xl overflow-hidden mx-auto flex flex-col items-center justify-center gap-2`}
            style={{ background: fallbackGradient }}
          >
            <img src={fallbackIcon} alt="" className="w-10 h-10 opacity-95 invert" />
            <span className="text-[13px] font-semibold tracking-wide text-background">
              {fallbackLabel}
            </span>
          </div>
        )}

        {/* Excerpt with fade effect */}
        {excerpt && (
          <div className="relative">
            <p className="text-muted-foreground leading-relaxed line-clamp-3">
              {excerpt}
            </p>
            <div className="absolute bottom-0 right-0 w-32 h-6 bg-gradient-to-l from-card to-transparent pointer-events-none" />
          </div>
        )}

        {/* Site Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.site.favicon && (
            <img
              src={data.site.favicon}
              alt=""
              className="w-4 h-4 rounded"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="font-medium">{data.site.name}</span>
          {data.meta.publishedTime && (
            <>
              <span>•</span>
              <time dateTime={data.meta.publishedTime}>
                {formatDate(data.meta.publishedTime)}
              </time>
            </>
          )}
        </div>

        {/* Read More Button */}
        <div className="pt-2">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            asChild
          >
            <a
              href={data.resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {ctaLabel}
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
};
