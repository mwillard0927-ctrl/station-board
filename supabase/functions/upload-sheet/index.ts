// Supabase Edge Function: upload-sheet
// Receives driver-list / pick-sheet PDFs from the Station Board "Upload PDF" button
// and drops them into the station-board repo's inbox/ folder. The repo's
// "Ingest station PDFs" GitHub Action then reads them and publishes the board.
//
// Secret needed (Supabase → Edge Functions → Secrets):  GH_TOKEN = GitHub token with
// Contents: read & write on mwillard0927-ctrl/station-board.
// Deploy with "Verify JWT" OFF (the board calls it with the public key only).

const REPO = "mwillard0927-ctrl/station-board";
const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per PDF

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  const token = Deno.env.get("GH_TOKEN");
  if (!token) return reply(500, { error: "GH_TOKEN secret not set" });

  let files: { name?: string; b64?: string }[];
  try { files = (await req.json()).files; } catch { return reply(400, { error: "bad request" }); }
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) return reply(400, { error: `send 1–${MAX_FILES} PDFs` });

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const saved: string[] = [];
  for (const [i, f] of files.entries()) {
    const b64 = String(f.b64 || "");
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return reply(400, { error: "file not readable" }); }
    if (bytes.length > MAX_BYTES) return reply(413, { error: "PDF too big" });
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return reply(415, { error: `${f.name || "file"} is not a PDF` });
    const safe = String(f.name || "sheet").replace(/[^A-Za-z0-9._-]/g, "_").slice(-60).replace(/\.pdf$/i, "");
    const path = `inbox/${stamp}-${i}-${safe}.pdf`;
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "station-board-upload" },
      body: JSON.stringify({ message: `Upload: ${safe}.pdf`, content: b64, branch: "main" }),
    });
    if (!r.ok) return reply(502, { error: `GitHub said ${r.status}`, saved });
    saved.push(path);
  }
  return reply(200, { ok: true, saved });
});
