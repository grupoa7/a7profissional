import { NextResponse } from "next/server";
import { pipefyQuery } from "@/lib/pipefy";
export const dynamic = "force-dynamic";
const PII = new Set(["nome", "cpf", "telefone"]);
export async function GET() {
  const info: Record<string, unknown> = {};
  try {
    const d: any = await pipefyQuery(
      `query($id:ID!){ table(id:$id){ table_records(first:8){ edges{ node{ id record_fields{ field{id} value array_value } } } } } }`,
      { id: "ZxbYr_AS" },
    );
    const edges = d.table.table_records.edges as any[];
    info.totalAmostra = edges.length;
    info.registros = edges.map((e) => {
      const f: Record<string, unknown> = {};
      for (const rf of e.node.record_fields) {
        const id = rf.field?.id;
        if (!id || PII.has(id)) continue;
        const v = rf.array_value && rf.array_value.length ? rf.array_value : rf.value;
        f[id] = v;
      }
      return f;
    });
  } catch (e) {
    info.err = String(e instanceof Error ? e.message : e).slice(0, 400);
  }
  return NextResponse.json(info);
}
