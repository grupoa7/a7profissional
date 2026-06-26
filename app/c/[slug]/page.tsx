// Página pública do CONVITE CEGO por LINK CURTO (/c/<slug>) — a cara amigável que
// mandamos no WhatsApp (o token longo assusta o trabalhador). Mesma tela e mesma lógica
// cega de /t/convite/[token]: o `slug` é só outra chave pública pro MESMO convite.
import { conviteView } from "@/lib/convites";
import Convite from "../../t/convite/[token]/Convite";
import "../../t/convite/[token]/convite.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { conviteMetadata as metadata } from "@/lib/convite-meta";

export default async function Page({ params }: { params: { slug: string } }) {
  const view = await conviteView(params.slug);

  if (!view.ok) {
    return (
      <main className="cv-wrap">
        <div className="cv-card cv-invalid">
          <div className="cv-logo">
            <span className="cv-logo-badge">a7</span>pro
          </div>
          <h1>Esse convite não está mais valendo 😕</h1>
          <p>Pode ser que tenha expirado ou já tenha sido encerrado. Se ainda tiver interesse, chama a gente que a gente te avisa na próxima.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="cv-wrap">
      <Convite conviteRef={params.slug} initial={view} />
    </main>
  );
}
