import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Helpers: safe DOM parsing on reader HTML (r.jina.ai result) ---
function decodeEntities(s: string) {
  // minimal decode; avoids showing &amp; etc.
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value.replace(/\s+/g, " ").trim();
}

function looksLikeBreadcrumbOrAd(el: Element): boolean {
  const cls = (el.getAttribute("class") || "").toLowerCase();
  const id  = (el.getAttribute("id") || "").toLowerCase();

  // common breadcrumb / meta / nav / ad wrappers
  const badTokens = [
    "breadcrumb","breadcrumbs","crumb","nav","subnav","skiplink",
    "promo","related","sidebar","share","social","footer",
    "ad","ads","advert","sponsor","newsletter","cookie","consent"
  ];

  return badTokens.some(t =>
    cls.includes(t) || id.includes(t) || el.tagName.toLowerCase()==="nav"
  );
}

function resolveUrlMaybeRelative(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch { return src; }
}

// Find the main content root in reader-mode HTML; fall back gracefully
function findArticleRoot(doc: Document): Element | null {
  const candidates = [
    "main article",
    "article",
    "main",
    "article [role='main']",
    "[data-component='article']",
    "[itemprop='articleBody']",
    ".article-content",
    ".post-content",
    ".entry-content",
    "#content"
  ];
  for (const sel of candidates) {
    const node = doc.querySelector(sel);
    if (node) return node;
  }
  // last resort: body
  return doc.body;
}

// Extract first meaningful paragraph and first useful image from the article
function extractLead(doc: Document, baseUrl: string): { leadText?: string; heroImg?: string } {
  const root = findArticleRoot(doc);
  if (!root) return {};

  // remove obvious non-content sections from the search path
  const pruned = root.cloneNode(true) as Element;
  pruned.querySelectorAll("*").forEach(el => {
    if (looksLikeBreadcrumbOrAd(el)) el.remove();
  });

  // 1) lead text: first non-empty paragraph with some length
  let leadText: string | undefined;
  const paras = Array.from(pruned.querySelectorAll("p"));
  for (const p of paras) {
    const t = decodeEntities(p.textContent || "");
    // skip copyright, "advertisement", etc.
    if (!t || t.length < 60) continue;
    if (/advert/i.test(t)) continue;
    leadText = t;
    break;
  }

  // 2) hero image: first good img from article area
  let heroImg: string | undefined;
  const imgs = Array.from(pruned.querySelectorAll("img"));
  for (const img of imgs) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!src) continue;
    if (src.startsWith("data:")) continue;
    heroImg = resolveUrlMaybeRelative(src, baseUrl);
    break;
  }

  return { leadText, heroImg };
}

// Optional: tighten summary to 2 sentences or ~200 chars
function summarizeLead(text: string): string {
  // prefer sentence boundary; fall back to char clamp
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
    // Fallback values
    let excerpt = data.meta.description || '';
    let heroImage = data.meta.image || null;
    
    // Try DOM-based extraction if we have HTML content
    if (data.content?.html) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.content.html, "text/html");
        
        const { leadText, heroImg } = extractLead(doc, data.resolvedUrl);
        
        // Use lead paragraph if found, otherwise keep meta description
        if (leadText) {
          excerpt = summarizeLead(leadText);
        }
        
        // Use hero image from article body if found, otherwise keep og:image
        if (heroImg) {
          heroImage = heroImg;
        }
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
