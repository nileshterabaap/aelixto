import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Helpers: safe DOM parsing on reader HTML (r.jina.ai result) ---
function decodeEntities(s: string) {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value.replace(/\s+/g, " ").trim();
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
}

export const ArticleContentEmbed = ({ data }: ArticleContentEmbedProps) => {
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
    let excerpt = data.meta.description || '';
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
          excerpt = summarize(lead);
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

  return (
    <article className="rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all">
      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Title */}
        <h3 className="text-xl font-bold leading-tight text-foreground">
          {data.meta.title}
        </h3>

        {/* Thumbnail */}
        {heroImage && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden bg-muted mx-auto">
            <img
              src={heroImage}
              alt={data.meta.title}
              className="w-full h-full object-cover object-center"
              loading="lazy"
              width="400"
              height="192"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
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
              Continue Reading
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
};
