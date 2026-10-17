/* Marca do painel: ícone de "dashboard" + nome. Em SVG com currentColor, então segue o
   tema (claro/escuro) sem precisar de duas imagens. Troque por o logo do seu produto. */

export const APP_NAME = "Painel Admin";

interface Props {
  /** Classe com o tamanho (o ícone acompanha a altura do texto). */
  className?: string;
  /** Mostra só o ícone, sem o nome. */
  compact?: boolean;
}

export function AppMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`app-mark ${className}`.trim()} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" />
      <rect x="7" y="7" width="8" height="11" rx="2" className="app-mark-tile" />
      <rect x="17" y="7" width="8" height="6" rx="2" className="app-mark-tile app-mark-accent" />
      <rect x="7" y="20" width="8" height="5" rx="2" className="app-mark-tile app-mark-accent" />
      <rect x="17" y="15" width="8" height="10" rx="2" className="app-mark-tile" />
    </svg>
  );
}

export default function AppLogo({ className = "", compact = false }: Props) {
  return (
    <span className={`app-logo ${className}`.trim()}>
      <AppMark />
      {!compact && <span className="app-logo-name">{APP_NAME}</span>}
    </span>
  );
}
