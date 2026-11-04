import { buildErrorView, buildSummary } from "../lib/summary";
import type { Dict } from "../lib/i18n";
import type { SessionState, Status } from "../lib/types";
import { ActivityCard, ErrorCard, FeedCard, PreviewCard } from "./LiveCards";
import { StatusHero } from "./StatusHero";

interface Props {
  d: Dict;
  s: SessionState;
  status: Status | null;
  now: number;
  hint: string | null;
  error: string | null;
  canStart: boolean;
  connectorNote: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function LiveView({ d, s, status, now, ...rest }: Props) {
  const summary = buildSummary(s, status, now, d);
  const err = buildErrorView(s, d);

  return (
    <div className="space-y-3">
      <StatusHero d={d} s={s} status={status} now={now} line={summary.now} {...rest} />
      <ActivityCard d={d} s={s} summary={summary} />
      {err && <ErrorCard d={d} view={err} />}
      <FeedCard d={d} s={s} now={now} />
      <div id="preview">
        <PreviewCard d={d} />
      </div>
    </div>
  );
}
