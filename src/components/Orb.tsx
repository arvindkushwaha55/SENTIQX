import { useId } from "react";
import type { Status } from "../lib/types";
import { AlertIcon, CheckIcon, ClockIcon, PulseIcon } from "./icons";

const CIRC = 2 * Math.PI * 44; // ring circumference

/**
 * Status core. Each status has its own motion: working scans, waiting breathes,
 * stuck blinks slowly, error and done hold steady. All motion is transform/opacity.
 */
export function Orb({ status, size = 104 }: { status: Status | null; size?: number }) {
  // Own gradient id: a shared one would break when the first Orb sits in a hidden tab.
  const gradient = useId();
  const state = status ?? "idle";
  const Icon = { working: PulseIcon, waiting: ClockIcon, stuck: ClockIcon, error: AlertIcon, done: CheckIcon, idle: PulseIcon }[state];

  return (
    <div
      data-status={state}
      className="relative shrink-0"
      style={{ width: size, height: size, color: "var(--c)" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <radialGradient id={gradient} cx="50%" cy="40%" r="70%">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
          </radialGradient>
        </defs>
        {/* tick ring */}
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.4"
          strokeDasharray="1 6.2"
          strokeLinecap="round"
          className={state === "working" ? "spin-slow" : ""}
        />
        {/* track */}
        <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="3" />
        {/* progress-less arc: it shows liveness only, never a percentage */}
        <circle
          cx="60"
          cy="60"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={state === "working" ? `${CIRC * 0.28} ${CIRC}` : state === "idle" ? `${CIRC * 0.08} ${CIRC}` : `${CIRC} ${CIRC}`}
          transform="rotate(-90 60 60)"
          className={state === "working" ? "spin" : state === "stuck" ? "blink" : ""}
          opacity={state === "idle" ? 0.5 : 1}
        />
        {/* glow + core */}
        <circle cx="60" cy="60" r="34" fill="currentColor" opacity="0.1" className={state === "waiting" || state === "working" ? "breathe" : ""} />
        <circle cx="60" cy="60" r="27" fill={`url(#${gradient})`} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <Icon size={Math.round(size * 0.25)} className={state === "idle" ? "opacity-60" : ""} />
      </div>
    </div>
  );
}
