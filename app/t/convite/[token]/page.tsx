// Página pública do CONVITE CEGO (S4 · sem login). O link mágico É a chave.
// O servidor valida o token (purpose:"convite") e projeta SÓ os dados cegos
// (bairro·função·valor·horário·data) — empresa/endereço NUNCA trafegam (revelação = S5).
// O `conviteId` vem do token assinado; nada de outro convite/titular aparece.
import { conviteView } from "@/lib/convites";
import Convite from "./Convite";
import "./convite.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { conviteMetadata as metadata } from "@/lib/convite-meta";

export default async function Page({ params }: { params: { token: string } }) {
  const view = await conviteView(params.token);

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
      <Convite conviteRef={params.token} initial={view} />
    </main>
  );
}
