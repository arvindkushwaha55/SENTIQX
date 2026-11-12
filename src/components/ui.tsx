import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <section
      className={`surface rise p-4 ${className}`}
      style={accent ? { borderLeft: `2px solid ${accent}` } : undefined}
    >
      {children}
    </section>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`label ${className}`}>{children}</p>;
}

type Variant = "primary" | "ghost" | "danger" | "subtle";

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles: Record<Variant, string> = {
    primary:
      "bg-gradient-to-r from-[var(--orange)] to-[var(--amber)] text-[var(--on-accent)] font-semibold shadow-[0_8px_24px_-12px_var(--orange)] hover:brightness-110",
    ghost:
      "border border-[var(--line-strong)] bg-[var(--glass)] text-[var(--text)] hover:border-[var(--muted)]",
    subtle: "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--line-strong)]",
    danger:
      "border border-[var(--line-strong)] bg-[var(--glass)] text-[var(--s-error)] hover:border-[var(--s-error)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition active:scale-[0.98] ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ children, color, title }: { children: ReactNode; color?: string; title?: string }) {
  return (
    <span className="chip" style={color ? { color } : undefined} title={title}>
      {children}
    </span>
  );
}

export function Empty({ icon, title, note }: { icon: ReactNode; title: string; note?: string }) {
  return (
    <div className="grid place-items-center px-4 py-8 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--line-strong)] bg-[var(--tint-cyan)] text-[var(--cyan)]">
        {icon}
      </div>
      <p className="text-[13px]">{title}</p>
      {note && <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-[var(--muted)]">{note}</p>}
    </div>
  );
}
