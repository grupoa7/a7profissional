import Link from "next/link";
import { Logo } from "../components/Logo";
import { launchPrice } from "@/lib/site";

export default function Cancelado() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 22 }}><Logo size={40} /></div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>Checkout cancelado</h1>
        <p style={{ fontSize: 16, color: "#5e5f63", lineHeight: 1.55, marginBottom: 28 }}>Sem problema — nada foi cobrado. Quando quiser, você assina por R${launchPrice}/mês e ativa em segundos.</p>
        <Link href="/#preco" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 700, color: "#fff", background: "#231F20", padding: "13px 22px", borderRadius: 12 }}>Ver o plano de novo</Link>
      </div>
    </main>
  );
}
