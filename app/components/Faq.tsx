const faqs = [
  { q: "Como vocês sabem que o profissional é bom?", a: "O selo (A, AA, AAA) e o histórico vêm de trabalhos verificados na plataforma. É informação de apoio pra sua decisão, nunca uma garantia. Quem está abaixo do padrão simplesmente não aparece." },
  { q: "Quando recebo o contato do profissional?", a: "Só depois que ele aceita o seu convite. Aí a gente libera nome completo, telefone e WhatsApp pra vocês fecharem direto." },
  { q: "A A7Pro contrata ou paga a diária?", a: "Não. A relação de cada trabalho é direta entre a sua empresa e o profissional. Não somos um serviço de intermediação: a gente organiza o encontro e não entra na negociação nem no pagamento." },
  { q: "Posso cancelar quando quiser?", a: "Pode, a qualquer momento e sem burocracia. Você assina por R$149/mês e cancela quando precisar." },
  { q: "Preciso marcar uma reunião pra começar?", a: "Não. É self-serve: você assina, ativa em segundos e já começa a enviar convites." },
];

export function Faq() {
  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(48px,7vw,80px) 24px clamp(64px,10vw,110px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(36px,5vw,72px)", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 240px", minWidth: 240 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.6px", color: "#AE863F", marginBottom: 16 }}>Dúvidas</div>
          <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", fontWeight: 800, letterSpacing: "-1.3px", lineHeight: 1.06, textWrap: "balance" }}>O que costumam perguntar.</h2>
        </div>
        <div style={{ flex: "2 1 480px", minWidth: 300, borderTop: "1px solid #E8E8E3" }}>
          {faqs.map((f) => (
            <details key={f.q} style={{ borderBottom: "1px solid #E8E8E3" }}>
              <summary className="h-sum" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 0", fontSize: 16.5, fontWeight: 700, letterSpacing: "-.3px", color: "#231F20", transition: "color .18s ease" }}>
                {f.q}
                <svg className="a7chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9b9c9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5e5f63", fontWeight: 400, padding: "0 0 22px", maxWidth: 620 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
