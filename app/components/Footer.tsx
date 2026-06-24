import { Logo } from "./Logo";

const notes = [
  <>O selo (A, AA, AAA, B e novato) e o histórico exibidos constituem <span style={{ color: "#231F20", fontWeight: 600 }}>informação de apoio à decisão, baseada em dados verificados na plataforma</span>. O selo reflete o tempo de histórico comprovado, não o desempenho; selos iniciais e novatos não constituem demérito. Não representam garantia de desempenho, recomendação ou vínculo de qualquer natureza.</>,
  <>A A7Pro disponibiliza acesso a um banco de profissionais e <span style={{ color: "#231F20", fontWeight: 600 }}>não presta serviço de intermediação ou agenciamento de mão de obra</span>. A contratação, a negociação e o pagamento ocorrem direta e exclusivamente entre a empresa e o profissional. A A7Pro não contrata, não intermedeia, não efetua pagamentos e não se responsabiliza pelos atos, pela conduta ou pelo desempenho dos profissionais contatados.</>,
  <>Profissionais que não atendem ao padrão da plataforma <span style={{ color: "#231F20", fontWeight: 600 }}>não são exibidos</span>. A ausência de um profissional não constitui avaliação negativa.</>,
];

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #E8E8E3", background: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 24px 52px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Logo size={23} />
          <span style={{ fontSize: 17, letterSpacing: "-.7px" }}><span style={{ fontWeight: 700, color: "#231F20" }}>A7</span><span style={{ fontWeight: 300, color: "#4A4744" }}>Pro</span></span>
          <span style={{ marginLeft: 3, paddingLeft: 11, borderLeft: "1px solid #E8E8E3", fontSize: 12.5, fontWeight: 500, color: "#9b9c9e", whiteSpace: "nowrap" }}>Banco de Talentos</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
          {notes.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b9c9e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 2 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "#5e5f63", fontWeight: 400 }}>{n}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 34, paddingTop: 22, borderTop: "1px solid #E8E8E3", fontSize: 12, color: "#9b9c9e", fontWeight: 500 }}>© 2025 A7Pro · Banco de Talentos. Todos os direitos reservados.</div>
      </div>
    </footer>
  );
}
