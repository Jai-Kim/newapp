// Storyloom — page illustration.
//
// Implements the identity/wardrobe split that Spike A proved (ADR-0001 §5):
// the child's LOCKED identity comes from a reference image, the wardrobe comes
// from the page. Spike A's original failure was over-preservation — told to
// change clothes, the model kept the reference outfit — and the fix is to name
// explicitly which parts of the reference are identity and which are wardrobe
// to be replaced. That wording is load-bearing; don't soften it.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Spike A recommendation: Flash, not Pro. 3.5x cheaper, 3.2x faster, and closer
// to the gouache house style. Pro is reserved for the printed keepsake.
const MODEL = "gemini-2.5-flash-image";

/** The house art style. Must be byte-identical across every render, forever. */
export const HOUSE_STYLE =
  "Children's picture-book illustration in soft gouache: warm limited palette "
  + "of cream, terracotta, sage and dusty teal; visible paper grain; gentle "
  + "rounded shapes; soft diffuse lighting; no hard black outlines; painterly "
  + "brush texture. Cosy, reassuring, bedtime-story mood.";

export interface IllustrateResult {
  page: number;
  image_base64: string;
  mime_type: string;
  latency_ms: number;
}

function buildPrompt(
  identityDescriptor: string,
  scene: string,
  wardrobe: string,
): string {
  return `The attached image is the LOCKED IDENTITY reference for this child.

PRESERVE EXACTLY (her identity — this never changes between pages):
${identityDescriptor}
Also preserve any recurring companion character exactly as drawn.

DO NOT COPY the clothing in the reference. Clothing is wardrobe, not identity,
and changes every page. Dress her in the WARDROBE below instead. Reproducing the
reference outfit when the wardrobe differs is a failure.

WARDROBE for this page: ${wardrobe}

SCENE: ${scene}

NO LETTERING. Do not draw any words, titles, captions, signage or handwriting
anywhere in the image. The page already carries its own text in two languages,
and burned-in words cannot be translated or edited. Illustration only.

Art style, identical on every page: ${HOUSE_STYLE}`;
}

export async function illustratePage(
  apiKey: string,
  identityPng: Uint8Array,
  identityDescriptor: string,
  page: number,
  scene: string,
  wardrobe: string,
): Promise<IllustrateResult> {
  const started = Date.now();

  // Chunked conversion — a spread operator over a ~1.6MB image blows the stack.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < identityPng.length; i += CHUNK) {
    binary += String.fromCharCode(...identityPng.subarray(i, i + CHUNK));
  }
  const identityB64 = btoa(binary);

  const res = await fetch(`${GEMINI_BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          // Reference first, instruction second — leading with the prompt tends
          // to produce a fresh character instead of a re-render (Spike A).
          { inline_data: { mime_type: "image/png", data: identityB64 } },
          { text: buildPrompt(identityDescriptor, scene, wardrobe) },
        ],
      }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3" },
      },
    }),
  });

  const latency_ms = Date.now() - started;
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`page ${page} failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const body = JSON.parse(raw) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
      finishReason?: string;
    }[];
  };
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) {
    throw new Error(
      `page ${page}: no image returned (finish=${body.candidates?.[0]?.finishReason})`,
    );
  }

  return {
    page,
    image_base64: part.inlineData.data,
    mime_type: part.inlineData.mimeType,
    latency_ms,
  };
}

/**
 * Which pages get a full illustration.
 *
 * Spike C: illustrations are ~70% of marginal cost, and illustrating every page
 * makes a nightly subscription lose money at any believable price. Picture books
 * routinely mix full art with text-only spreads, so we spread N illustrations
 * evenly — always including the first page, which is the one a parent sees in
 * the library.
 */
export function choosePages(totalPages: number, count: number): number[] {
  if (count >= totalPages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (count <= 1) {
    return [1];
  }
  const step = (totalPages - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(1 + i * step));
}
