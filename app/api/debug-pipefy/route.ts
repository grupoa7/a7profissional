import { NextResponse } from "next/server";
import { getTalentCards } from "@/lib/talent";
export const dynamic = "force-dynamic";
export async function GET() {
  const info: Record<string, unknown> = {};
  try {
    const cards = await getTalentCards();
    info.count = cards.length;
    info.sample = cards.slice(0, 2).map((c) => ({ selo: c.selo, dias: c.dias.length, turnos: c.turnos.length, vsex: c.valorSegSex }));
  } catch (e) {
    info.talentError = String(e instanceof Error ? (e.stack ?? e.message) : e).slice(0, 600);
  }
  return NextResponse.json(info);
}
