"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/modules";
import { useSidebar } from "./AppSidebar";
import ModuleIcon, { type IconName } from "./ModuleIcon";

interface Props {
  title: string;
  subtitle: string;
  href?: string;
  /** Ícone do menu lateral para a página (módulo, início ou configurações). */
  icon?: IconName;
}

export default function AppHeader({ title, subtitle, href = "/", icon }: Props) {
  const sidebar = useSidebar();
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const dark = window.localStorage.getItem(THEME_STORAGE_KEY) !== "light";
    setDarkMode(dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  /* A preferência só é gravada quando o usuário troca o tema: um efeito que gravasse
     o estado inicial ("escuro") sobrescreveria a escolha salva ao abrir a página. */
  const toggleTheme = () => {
    const dark = !darkMode;
    setDarkMode(dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  };

  return (
    <header className="top">
      <div className="top-inner">
        <div className="top-brand">
          {sidebar.available && (
            <button
              className="btn on-dark menu-toggle"
              onClick={sidebar.toggle}
              aria-label={sidebar.expanded ? "Recolher menu" : "Abrir menu"}
              aria-expanded={sidebar.expanded}
            >
              ☰
            </button>
          )}
          {icon && (
            <span className="top-icon">
              <ModuleIcon name={icon} fallback={title} />
            </span>
          )}
          <div>
            <h1>
              <Link className="brand-link" href={href}>
                {title}
              </Link>
            </h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="top-user demo-badge" title="Dados fictícios: recarregar a página volta ao estado inicial.">
            Demonstração
          </span>
          <button className="btn on-dark theme-toggle" onClick={toggleTheme}>
            {darkMode ? "Modo claro" : "Modo escuro"}
          </button>
          <Link className="btn on-dark" href="/configuracoes">
            Configurações
          </Link>
        </div>
      </div>
    </header>
  );
}
