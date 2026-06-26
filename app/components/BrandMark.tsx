import { Logo } from "./Logo";

// Lockup OFICIAL da marca (símbolo SVG + wordmark "A7Pro"), unificado em todo o portal.
// Substitui os antigos lockups "caixinha" ([a7]pro) que variavam por tela.
// `sub` (opcional) rende o descritor da tela à direita, com divisória — igual ao header da landing.
export function BrandMark({ size = 26, sub }: { size?: number; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <Logo size={size} />
      <span style={{ fontSize: Math.round(size * 0.74), letterSpacing: "-1px", lineHeight: 1 }}>
        <span style={{ fontWeight: 700, color: "#231F20" }}>A7</span>
        <span style={{ fontWeight: 300, color: "#4A4744" }}>Pro</span>
      </span>
      {sub && (
        <span style={{ marginLeft: 3, paddingLeft: 11, borderLeft: "1px solid #E2E1DC", fontSize: 13, fontWeight: 500, color: "#8C8884", letterSpacing: "-.1px", whiteSpace: "nowrap" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
