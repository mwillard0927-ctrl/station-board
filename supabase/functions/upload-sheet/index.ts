const REPO = "mwillard0927-ctrl/station-board";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  const token = Deno.env.get("GH_TOKEN");
  if (!token) return reply(500, { error: "GH_TOKEN secret not set" });
  let files: { name?: string; b64?: string }[] = [];
  try { files = (await req.json()).files; } catch (_e) { return reply(400, { error: "bad request" }); }
  if (!Array.isArray(files) || files.length < 1 || files.length > 4) return reply(400, { error: "send 1-4 PDFs" });
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const saved: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const b64 = String(f.b64 || "");
    if (b64.length > 11000000) return reply(413, { error: "PDF too big" });
    if (!b64.startsWith("JVBERi")) return reply(415, { error: "not a PDF" });
    const safe = String(f.name || "sheet").replace(/[^A-Za-z0-9._-]/g, "_").slice(-60).replace(/\.pdf$/i, "");
    const path = "inbox/" + stamp + "-" + i + "-" + safe + ".pdf";
    const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + path, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "station-board-upload" },
      body: JSON.stringify({ message: "Upload: " + safe + ".pdf", content: b64, branch: "main" }),
    });
    if (!r.ok) return reply(502, { error: "GitHub said " + r.status, saved: saved });
    saved.push(path);
  }
  return reply(200, { ok: true, saved: saved });
});
