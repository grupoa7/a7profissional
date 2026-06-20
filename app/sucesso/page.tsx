import Link from "next/link";
import { Logo } from "../components/Logo";

export default function Sucesso() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 22 }}><Logo size={40} /></div>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#eef4f0", border: "1px solid #cfe7d8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2f7d52" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>Assinatura confirmada!</h1>
        <p style={{ fontSize: 16, color: "#5e5f63", lineHeight: 1.55, marginBottom: 28 }}>Boas-vindas ao A7Pro · Banco de Talentos. Seu acesso está ativo — em instantes você já pode começar a convidar profissionais.</p>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 700, color: "#fff", background: "#231F20", padding: "13px 22px", borderRadius: 12 }}>Voltar ao início</Link>
      </div>
    </main>
  );
}
