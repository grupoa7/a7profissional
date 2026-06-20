import { SubscribeButton } from "./SubscribeButton";

const mono = "'SF Mono',ui-monospace,'Roboto Mono',Menlo,monospace";

export function Hero() {
  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px clamp(60px,10vw,118px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(40px,6vw,72px)", alignItems: "center" }}>
        {/* LEFT */}
        <div style={{ flex: "1 1 440px", minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
            <span style={{ width: 26, height: 2, background: "#AE863F", display: "block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.6px", color: "#5e5f63" }}>Imprevisto acontece. Susto, não.</span>
          </div>
          <h1 style={{ fontSize: "clamp(38px,5.6vw,66px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-2px", marginBottom: 24, textWrap: "balance" }}>
            Complete sua escala com quem já <span style={{ color: "#AE863F" }}>provou que aparece.</span>
          </h1>
          <p style={{ fontSize: "clamp(18px,1.7vw,21px)", lineHeight: 1.5, color: "#46474b", maxWidth: 520, fontWeight: 400, marginBottom: 36, letterSpacing: "-.2px" }}>
            Profissionais com <strong style={{ color: "#231F20", fontWeight: 600 }}>histórico verificado</strong>, prontos pra cobrir folga, pico e os dias de maior venda. Você <strong style={{ color: "#231F20", fontWeight: 600 }}>convida, fecha direto</strong>, e chama de volta quem é bom.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginBottom: 12 }}>
            <SubscribeButton variant="hero" />
            <a href="#disponiveis" className="h-sec" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "#231F20", borderBottom: "1px solid #c9c9c2", paddingBottom: 2, transition: "border-color .15s" }}>Ver quem está disponível</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 30, fontSize: 12.5, color: "#9b9c9e", fontWeight: 500, letterSpacing: "-.1px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#AE863F", display: "block", flex: "0 0 auto" }} />
            Oferta de lançamento por tempo limitado
          </div>
          <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #E8E8E3", borderRadius: 14, overflow: "hidden", background: "#fff", maxWidth: 480 }}>
            {[["Ativação", "em segundos"], ["Cancelamento", "quando quiser"], ["Reunião", "dispensada"]].map(([k, v], i) => (
              <div key={k} style={{ flex: 1, padding: "13px 16px", borderLeft: i ? "1px solid #E8E8E3" : "none" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#AE863F", marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-.2px" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* RIGHT: product card */}
        <div style={{ flex: "1 1 380px", minWidth: 300, position: "relative", display: "flex", justifyContent: "center", padding: "14px 0" }}>
          <div style={{ position: "absolute", top: 30, left: "50%", width: "min(330px,86%)", height: "84%", background: "#fff", border: "1px solid #ECECE6", borderRadius: 18, transform: "translateX(-50%) rotate(-3.5deg)", boxShadow: "0 30px 60px rgba(20,20,20,.05)" }} />
          <div style={{ position: "relative", width: "min(380px,100%)", background: "#fff", border: "1px solid #E8E8E3", borderRadius: 18, padding: "20px 20px 18px", transform: "rotate(1.6deg)", boxShadow: "0 40px 80px -20px rgba(20,20,20,.18),0 8px 24px rgba(20,20,20,.05)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F0F0EB", color: "#231F20", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, letterSpacing: "-.5px" }}>JS</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16.5, letterSpacing: "-.3px" }}>João S.</div>
                <div style={{ fontSize: 13, color: "#5e5f63" }}>Garçom</div>
              </div>
              <div style={{ background: "#231F20", color: "#fff", fontWeight: 800, fontSize: 13, padding: "6px 11px", borderRadius: 9, letterSpacing: ".4px", textAlign: "center", lineHeight: 1 }}>AAA<span style={{ display: "block", fontSize: 8, fontWeight: 700, opacity: .65, letterSpacing: ".4px", marginTop: 2 }}>EXCELÊNCIA</span></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "#231F20" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9b9c9e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>
                Salvador
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#2f7d52" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2f7d52", display: "block", animation: "a7pulse 2.2s infinite" }} />
                ativo há 3 dias
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Sex", "Sáb", "Dom"].map((t) => <span key={t} style={{ fontSize: 12, fontWeight: 600, background: "#F0F0EB", color: "#5e5f63", borderRadius: 7, padding: "4px 9px" }}>{t}</span>)}
              <span style={{ fontSize: 12, fontWeight: 600, background: "#eef1ee", color: "#3f5a47", borderRadius: 7, padding: "4px 9px" }}>Noite</span>
            </div>
            <div style={{ display: "flex", border: "1px solid #E8E8E3", borderRadius: 12, overflow: "hidden", background: "#F5F4F1" }}>
              {[["Comparec.", "96%"], ["Turnos", "12"], ["Chamariam", "5"]].map(([k, v], i) => (
                <div key={k} style={{ flex: 1, padding: "11px 13px", borderRight: i < 2 ? "1px solid #E8E8E3" : "none" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".7px", color: "#9b9c9e", marginBottom: 4 }}>{k}</div>
                  <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 700, letterSpacing: "-1px" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#9b9c9e", fontWeight: 500 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
                contato após o aceite
              </span>
              <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#fff", background: "#231F20", padding: "8px 13px", borderRadius: 9 }}>Enviar convite</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
