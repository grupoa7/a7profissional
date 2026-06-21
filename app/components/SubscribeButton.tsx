"use client";
import { useState } from "react";
import { launchPrice } from "@/lib/site";

const Arrow = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h13M12 5l7 7-7 7" />
  </svg>
);

type Variant = "hero" | "price" | "header";

export function SubscribeButton({ variant }: { variant: Variant }) {
  const [loading, setLoading] = useState(false);
  // Navegação de página direta pro endpoint GET (que redireciona pro Stripe).
  // Evita fetch/CORS — funciona mesmo com o redirect apex->www.
  function go() {
    if (loading) return;
    setLoading(true);
    window.location.href = "/api/checkout";
  }

  if (variant === "header") {
    return (
      <button onClick={go} className="h-as" style={{
        fontSize: 14, fontWeight: 700, color: "#fff", background: "#231F20",
        padding: "10px 18px", borderRadius: 10, letterSpacing: "-.1px",
        border: "none", cursor: "pointer", transition: "opacity .15s",
      }}>{loading ? "..." : "Assinar"}</button>
    );
  }

  const isPrice = variant === "price";
  return (
    <button onClick={go} className={isPrice ? "h-price" : "h-cta"} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
      fontSize: 16, fontWeight: 700, color: "#fff", background: "#231F20",
      padding: isPrice ? "16px" : "15px 24px", borderRadius: 12, letterSpacing: "-.2px",
      width: isPrice ? "100%" : undefined, border: "none", cursor: "pointer",
      boxShadow: isPrice ? "0 10px 26px rgba(20,20,20,.16)" : "0 10px 28px rgba(20,20,20,.14)",
      transition: "transform .15s,box-shadow .15s",
    }}>
      <span style={{ whiteSpace: "nowrap" }}>{loading ? "Abrindo checkout..." : <>Assine agora por <span style={{ fontWeight: 800 }}>R${launchPrice}/mês</span></>}</span>
      {!loading && <Arrow />}
    </button>
  );
}
