import { launchPrice } from "@/lib/site";
import { SubscribeButton } from "./SubscribeButton";

const benefits = [
  "Acesso ao banco inteiro de profissionais provados",
  "Convites ilimitados · contato liberado no aceite",
  "Selo objetivo e histórico verificado em cada perfil",
  "Seu time de favoritos pra chamar de volta quem é bom",
];

export function Pricing() {
  return (
    <section id="preco" style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(64px,10vw,118px) 24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(40px,6vw,72px)", alignItems: "center" }}>
        <div style={{ flex: "1 1 340px", minWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.6px", color: "#AE863F", marginBottom: 16 }}>Preço</div>
          <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.06, marginBottom: 20, textWrap: "balance" }}>Um plano só. Garanta agora, cancele quando quiser.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "#5e5f63", fontWeight: 400, maxWidth: 420 }}>Acesso direto ao banco inteiro, convites ilimitados e seu time de favoritos. Self-serve, sem reunião: você ativa e já começa a convidar.</p>
        </div>
        <div style={{ flex: "1 1 380px", minWidth: 300, maxWidth: 460, background: "#fff", border: "1px solid #E8E8E3", borderRadius: 20, padding: 30, boxShadow: "0 40px 90px -30px rgba(20,20,20,.15),0 6px 20px rgba(20,20,20,.04)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#faf4e6", border: "1px solid #e9d9ad", color: "#8a6d1f", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".9px", padding: "5px 11px", borderRadius: 30, marginBottom: 24, whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#AE863F", display: "block" }} />Lançamento · tempo limitado
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: "clamp(44px,6vw,58px)", fontWeight: 800, letterSpacing: "-2.5px", fontVariantNumeric: "tabular-nums" }}>R${launchPrice}</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#5e5f63" }}>por mês</span>
          </div>
          <div style={{ fontSize: 14, color: "#9b9c9e", fontWeight: 500, marginBottom: 26 }}>Garanta agora e cancele quando quiser. Sem fidelidade.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "24px 0", borderTop: "1px solid #E8E8E3", borderBottom: "1px solid #E8E8E3", marginBottom: 26 }}>
            {benefits.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AE863F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 1 }}><path d="M20 6 9 17l-5-5" /></svg>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{b}</span>
              </div>
            ))}
          </div>
          <SubscribeButton variant="price" />
          <div style={{ textAlign: "center", marginTop: 11, fontSize: 12, color: "#9b9c9e", fontWeight: 500, lineHeight: 1.4 }}>Preço de lançamento · por tempo limitado</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "7px 12px", marginTop: 16, paddingTop: 15, borderTop: "1px solid #F0F0EB", fontSize: 12.5, color: "#9b9c9e", fontWeight: 500 }}>
            <span>Apple Pay</span><span style={{ color: "#d8d8d2" }}>·</span><span>Cartão</span><span style={{ color: "#d8d8d2" }}>·</span><span>self-serve, sem reunião</span>
          </div>
        </div>
      </div>
    </section>
  );
}
