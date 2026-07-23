import type { ReactNode } from 'react';

/**
 * Page title block for the portal screens.
 *
 * Exists so the five screens stop each inventing their own heading size and
 * gap: H1 (28px bold) + Small (12px, neutral grey) + an optional action slot,
 * with the 32px page-margin step below it applied by the caller's `space-y-8`.
 */
export function PagePortalHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="portal-h1 text-foreground">{title}</h1>
        {subtitle ? (
          <p className="portal-small text-portal-neutral">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Section heading inside a page: H2 (20px semibold) plus an optional right-hand
 * slot for a badge or hint. Used by the primary cards so a section header is
 * visibly heavier than the labels inside it.
 */
export function SectionHeading({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-portal-neutral">{icon}</span> : null}
        <h2 className="portal-h2 text-foreground">{title}</h2>
        {hint ? <span className="portal-small text-portal-neutral">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}
