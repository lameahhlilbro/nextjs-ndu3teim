import OpenAI from "openai";

export const runtime = "nodejs"; // ensure server runtime on Vercel

function splitIntoWordChunks(text: string, chunkWords = 2500) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkWords) {
    chunks.push(words.slice(i, i + chunkWords).join(" "));
  }
  return chunks;
}

function countWords(s: string) {
  return (s.trim().match(/\b\w+\b/g) || []).length;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      text,
      targetWords = 7000,
      model = "gpt-4.1-mini",
      preserveQuotes = true,
    } = body || {};

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), { status: 400 });
    }

    const totalWords = countWords(text);
    if (totalWords > 22000) {
      return new Response(
        JSON.stringify({ error: `Input too long: ${totalWords} words (limit ~20–22k).` }),
        { status: 413 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Stage 1 — chunked partial summaries
    const chunks = splitIntoWordChunks(text, 2500);
    const partials: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = `You are a meticulous long-form summarizer. Summarize the CHUNK below into an analytical, structured brief that preserves nuance.

CHUNK INDEX: ${i + 1} of ${chunks.length}
GOAL: Create a rich partial summary (900–1200 words) that will later be merged.
FOCUS: key claims, evidence, timelines, stats/figures, named entities, definitions, contradictions, open questions, and any causal chains.
STYLE: Use markdown with clear section headings and bullets. Keep short quotes if they are pivotal${preserveQuotes ? " (preserve short quotes verbatim when crucial)" : " (paraphrase quotes)"}.

CHUNK:

${chunk}`;

      const res = await openai.responses.create({
        model,
        input: prompt,
      });
      // @ts-ignore - helper on Responses API SDKs
      const sum = (res as any).output_text ?? "";
      partials.push(`\n\n### Partial ${i + 1}\n${sum}`);
    }

    // Stage 2 — merge to target length
    const mergePrompt = `You will now MERGE the partial summaries into a single, coherent DEEP-DIVE SUMMARY.

TARGET LENGTH: about ${targetWords} words (±10%).
READER: smart non-expert who wants detail without fluff.
OUTPUT: Markdown with these top-level sections:
- Executive Summary (200–300 words)
- Key Points & Takeaways
- Detailed Synthesis (organized by topic or chronology)
- Contradictions & Uncertainties
- Notable Quotes (${preserveQuotes ? "short verbatim quotes allowed" : "paraphrase quotes"})
- Glossary of Terms & Entities
- Open Questions / Next Steps

REQUIREMENTS:
- Integrate facts across parts; avoid repetition.
- Maintain original nuance; don’t invent facts.
- Keep important numbers, names, dates.
- Prefer active voice and clean headings.

PARTIAL SUMMARIES:
${partials.join("\n")}`;

    const finalRes = await openai.responses.create({
      model,
      input: mergePrompt,
    });
    // @ts-ignore
    const finalText = (finalRes as any).output_text ?? "";

    return new Response(
      JSON.stringify({ summary: finalText, wordCount: countWords(finalText) }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
    });
  }
}
