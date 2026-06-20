import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { AvailabilityBoard } from "./components/AvailabilityBoard";
import { HowItWorks } from "./components/HowItWorks";
import { Proof } from "./components/Proof";
import { Pricing } from "./components/Pricing";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";

// Liga/desliga a seção "Disponíveis agora" (dados de exemplo isolados em AvailabilityBoard).
const showAvailability = true;

export default function Home() {
  return (
    <div style={{ background: "#F5F4F1", color: "#231F20", minHeight: "100vh", overflowX: "hidden" }}>
      <Header />
      <Hero />

      {showAvailability && (
        <section id="disponiveis" style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(40px,6vw,64px) 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 18, marginBottom: 30 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#eef4f0", border: "1px solid #cfe7d8", color: "#2f7d52", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", padding: "5px 11px", borderRadius: 30, whiteSpace: "nowrap" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2f7d52", display: "block", animation: "a7pulse 2.2s infinite" }} />Amostra ao vivo
                </span>
              </div>
              <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", fontWeight: 800, letterSpacing: "-1.3px", lineHeight: 1.05 }}>Disponíveis agora perto de você</h2>
            </div>
            <p style={{ fontSize: 13.5, color: "#9b9c9e", maxWidth: 300, lineHeight: 1.5, fontWeight: 500 }}>Identidade e contato só pra assinantes, e só depois que o profissional aceita.</p>
          </div>
          <AvailabilityBoard />
        </section>
      )}

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(64px,10vw,118px) 24px" }}>
        <div style={{ maxWidth: 660, marginBottom: "clamp(40px,6vw,60px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.6px", color: "#AE863F", marginBottom: 16 }}>Como funciona</div>
          <h2 style={{ fontSize: "clamp(28px,3.8vw,44px)", fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.04, marginBottom: 18, textWrap: "balance" }}>Da folga de sábado ao garçom confirmado em <span style={{ color: "#AE863F" }}>quatro passos.</span></h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, color: "#5e5f63", fontWeight: 400, maxWidth: 540 }}>Sem cadastrar vaga, sem esperar retorno, sem reunião. Você filtra por dia e turno, escolhe quem tem o melhor histórico e convida. O contato só é liberado quando o profissional aceita.</p>
        </div>
        <HowItWorks />
        <div style={{ marginTop: "clamp(40px,5vw,56px)", paddingTop: 26, borderTop: "1px solid #E8E8E3", display: "flex", alignItems: "flex-start", gap: 13 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#231F20" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 3 }}><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>
          <p style={{ fontSize: 15.5, fontWeight: 400, color: "#5e5f63", lineHeight: 1.55, maxWidth: 780 }}>A A7Pro <span style={{ color: "#231F20", fontWeight: 700 }}>apenas apresenta profissionais que desejam prestar serviços a empresas que procuram por eles.</span> Não somos uma ferramenta de intermediação ou de agenciamento de mão de obra: não participamos da contratação, da negociação ou do pagamento, e não nos responsabilizamos pela conduta, pela idoneidade ou pelo desempenho de nenhuma das partes.</p>
        </div>
      </section>

      <Proof />
      <Pricing />
      <Faq />
      <Footer />
    </div>
  );
}
