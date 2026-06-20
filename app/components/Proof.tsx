export function Proof() {
  return (
    <section style={{ background: "#231F20", color: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(64px,10vw,116px) 24px" }}>
        <div style={{ maxWidth: 880 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#AE863F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 28, opacity: .9 }}><path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6" /></svg>
          <blockquote style={{ fontSize: "clamp(24px,3.6vw,40px)", fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.22, textWrap: "balance" }}>Cobri a folga do sábado e ainda chamei dois bons garçons pra vender mais. Em <span style={{ color: "#AE863F" }}>15 minutos</span> resolvi o que antes me tomava a semana.</blockquote>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34 }}>
            <span style={{ width: 44, height: 1, background: "rgba(255,255,255,.3)", display: "block" }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px" }}>Marcelo R.</div>
              <div style={{ fontSize: 13.5, color: "#9b9c9e", fontWeight: 500 }}>dono de restaurante · Salvador</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
