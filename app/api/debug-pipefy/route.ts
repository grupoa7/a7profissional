import { NextResponse } from "next/server";
import { getTalentCards } from "@/lib/talent";
export const dynamic = "force-dynamic";
export async function GET() {
  const info: Record<string, unknown> = {};
  try {
    const cards = await getTalentCards();
    info.count = cards.length;
    info.sample = cards.slice(0, 3).map((c) => ({ nome: c.nomeParcial, selo: c.selo, dias: c.dias, turnos: c.turnos, vsex: c.valorSegSex, vfds: c.valorFds, at: c.atualizadoEm, func: c.funcao }));
  } catch (e) {
    info.err = String(e instanceof Error ? e.message : e).slice(0, 400);
  }
  return NextResponse.json(info);
}
