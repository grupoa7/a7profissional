import type { Metadata } from "next";
import { BrandMark } from "../components/BrandMark";
import "./entrar.css";

export const metadata: Metadata = {
  title: "Entrar · A7Pro · Portal da Empresa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MSGS: Record<string, { tipo: "ok" | "err"; texto: string }> = {
  enviado: {
    tipo: "ok",
    texto:
      "Se este e-mail tiver acesso ao portal, enviamos um link de entrada. Confira sua caixa (e o spam). O link vale por 20 minutos.",
  },
  invalido: { tipo: "err", texto: "E-mail inválido. Confira e tente de novo." },
  expirado: {
    tipo: "err",
    texto: "Esse link expirou ou já foi usado. Peça um novo abaixo.",
  },
  "sem-acesso": {
    tipo: "err",
    texto:
      "Sua sessão não tem acesso ao banco. O acesso é exclusivo de empresas parceiras com contrato ativo.",
  },
  saiu: { tipo: "ok", texto: "Você saiu da sua conta." },
};

export default function EntrarPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const msg = searchParams.status ? MSGS[searchParams.status] : null;
  // Só auto-foca no primeiro acesso. Na tela de resultado (com mensagem), evitar o
  // foco impede o iOS de reabrir o teclado e rolar pra longe do aviso de sucesso.
  const autoFocar = !msg;

  return (
    <div className="entrar-wrap">
      <div className="entrar-card">
        <div className="entrar-logo">
          <BrandMark size={26} />
        </div>
        <div className="entrar-sub">Banco de Talentos · Portal da Empresa</div>

        <h1>Entrar</h1>
        <p className="lead">
          Acesso exclusivo de empresas parceiras. Informe seu e-mail e enviamos um
          link de entrada, sem senha.
        </p>

        {msg && <div className={`entrar-msg ${msg.tipo}`}>{msg.texto}</div>}

        <form className="entrar-form" method="post" action="/api/auth/request">
          <label htmlFor="email">E-mail da empresa</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            required
            autoFocus={autoFocar}
          />
          <button className="entrar-btn" type="submit">
            Receber link de acesso →
          </button>
        </form>

        <div className="entrar-foot">
          O acesso ao banco é regido pelo <b>Contrato de Adesão A7Pro</b> e revogado ao
          término do contrato. Dados para consulta na plataforma.
        </div>
      </div>
    </div>
  );
}
