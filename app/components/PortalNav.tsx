import { BrandMark } from "./BrandMark";

// NAVEGAÇÃO ÚNICA do portal da empresa (S7). Antes cada tela tinha um menu diferente e
// apagado no canto — aqui o mesmo conjunto de links aparece em todas, com a tela atual
// destacada (sublinhado dourado). Logo via BrandMark, consistente com a landing.
const LINKS = [
  { href: "/portal", label: "Busca" },
  { href: "/portal/pedidos", label: "Meus pedidos" },
  { href: "/portal/turnos", label: "Turnos a avaliar" },
];

export function PortalNav({ email, atual, sub }: { email: string; atual: string; sub?: string }) {
  return (
    <header>
      <div className="hd">
        <div className="logo"><BrandMark size={24} sub={sub} /></div>
        <div className="who">
          {email} · <b>Plano Fundador</b>
          <nav className="pnav">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={l.href === atual ? "pnav-on" : undefined}
                aria-current={l.href === atual ? "page" : undefined}
              >
                {l.label}
              </a>
            ))}
            <a href="/api/auth/sair">Sair</a>
          </nav>
        </div>
      </div>
    </header>
  );
}
