"use client";
import { useMemo, useState } from "react";

function countWords(s: string) {
  return (s.trim().match(/\b\w+\b/g) || []).length;
}

export default function HomePage() {
  const [text, setText] = useState("");
  const [targetWords, setTargetWords] = useState(7000);
  const [preserveQuotes, setPreserveQuotes] = useState(true);
  const [model, setModel] = useState("gpt-4.1-mini");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");

  const wordCount = useMemo(() => countWords(text), [text]);

  async function onSummarize() {
    setError(null);
    setSummary("");
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetWords, model, preserveQuotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setSummary(data.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // fixed regex
    if (!/\.(txt|md)$/i.test(f.name)) {
      alert("Please upload a .txt or .md file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(f);
  }

  function copy(out: string) {
    navigator.clipboard.writeText(out);
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">DeepDive Summarizer</h1>
          <a
            href="https://vercel.com/new"
            className="text-sm underline opacity-70 hover:opacity-100"
            target="_blank"
          >
            Deploy
          </a>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold">Source Text</label>
              <span className="text-xs text-gray-500">
                {wordCount.toLocaleString()} words
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste up to ~20,000 words here or upload a .txt/.md file..."
              className="w-full h-72 sm:h-96 resize-y rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-3">
              <input type="file" accept=".txt,.md" onChange={onFile} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
            <div>
              <label className="font-semibold">Target Length (words)</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="range"
                  min={1500}
                  max={10000}
                  step={250}
                  value={targetWords}
                  onChange={(e) => setTargetWords(parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="tabular-nums w-20 text-right">{targetWords}</span>
              </div>
            </div>

            <div>
              <label className="font-semibold">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 p-2"
              >
                <option value="gpt-4.1-mini">gpt-4.1-mini (fast & cost-efficient)</option>
                <option value="gpt-4.1">gpt-4.1 (very strong long-context)</option>
                <option value="gpt-4o">gpt-4o (multi-modal generalist)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="quotes"
                type="checkbox"
                checked={preserveQuotes}
                onChange={(e) => setPreserveQuotes(e.target.checked)}
              />
              <label htmlFor="quotes">Preserve short quotes verbatim when pivotal</label>
            </div>

            <button
              onClick={onSummarize}
              disabled={loading || wordCount === 0}
              className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Summarizing…" : "Summarize"}
            </button>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            {summary && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Summary</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copy(summary)}
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([summary], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "deepdive-summary.md";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Download .md
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={summary}
                  className="w-full h-72 sm:h-96 resize-y rounded-xl border border-gray-200 p-3"
                />
              </div>
            )}
          </div>
        </section>

        <footer className="text-xs text-gray-500">
          <p>
            Tip: The server chunks ~2,500-word segments, summarizes each, then merges
            to your target length.
          </p>
        </footer>
      </div>
    </main>
  );
}
