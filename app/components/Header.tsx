import { Logo } from "./Logo";
import { SubscribeButton } from "./SubscribeButton";

export function Header() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(245,244,241,.82)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", borderBottom: "1px solid #E8E8E3" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Logo size={29} />
          <span style={{ fontSize: 21, letterSpacing: "-1px", lineHeight: 1 }}>
            <span style={{ fontWeight: 700, color: "#231F20" }}>A7</span>
            <span style={{ fontWeight: 300, color: "#4A4744" }}>Pro</span>
          </span>
          <span className="a7-desc" style={{ marginLeft: 3, paddingLeft: 13, borderLeft: "1px solid #E2E1DC", fontSize: 13, fontWeight: 500, color: "#8C8884", letterSpacing: "-.1px", whiteSpace: "nowrap" }}>Banco de Talentos</span>
        </div>
        <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
          <a href="#" style={{ fontSize: 14, fontWeight: 600, color: "#231F20" }}>Entrar</a>
          <SubscribeButton variant="header" />
        </nav>
      </div>
    </header>
  );
}
