import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const raw = process.env.PIPEFY_TOKEN;
  const tok = raw?.trim();
  const info: Record<string, unknown> = {
    tokenPresent: !!raw,
    rawLen: raw ? raw.length : 0,
    trimLen: tok ? tok.length : 0,
    startsWith: tok ? tok.slice(0, 4) : null,
  };
  try {
    const r = await fetch("https://api.pipefy.com/graphql", {
      method: "POST",
      headers: { Authorization: "Bearer " + (tok ?? ""), "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query($id:ID!){ table(id:$id){ name table_records(first:1){ edges{ node{ id } } } } }", variables: { id: "ZxbYr_AS" } }),
      cache: "no-store",
    });
    info.httpStatus = r.status;
    const d = await r.json();
    info.hasErrors = !!d.errors;
    info.errors = d.errors ? JSON.stringify(d.errors).slice(0, 300) : null;
    info.tableName = d.data?.table?.name ?? null;
  } catch (e) {
    info.fetchError = String(e instanceof Error ? e.message : e).slice(0, 300);
  }
  return NextResponse.json(info);
}
