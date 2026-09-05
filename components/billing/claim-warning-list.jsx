"use client";

import { claimWarningDeepLink } from "@/lib/claim-warning-nav";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   warnings: string[],
 *   className?: string,
 *   itemClassName?: string,
 *   resolveContext?: (warning: string) => import("@/lib/claim-warning-nav").ClaimWarningContext,
 * }} props
 */
export default function ClaimWarningList({
  warnings = [],
  className,
  itemClassName,
  resolveContext,
}) {
  if (!warnings?.length) return null;

  return (
    <ul className={cn("mt-2 list-disc pl-5 space-y-1", className)}>
      {warnings.map((w) => {
        const ctx = typeof resolveContext === "function" ? resolveContext(w) : {};
        const link = claimWarningDeepLink(w, ctx || {});
        return (
          <li key={w} className={cn(itemClassName)}>
            {link ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                title={link.fixLabel}
                className="underline decoration-amber-700/50 underline-offset-2 hover:decoration-teal-700 hover:text-teal-800"
              >
                {w}
              </a>
            ) : (
              w
            )}
          </li>
        );
      })}
    </ul>
  );
}
