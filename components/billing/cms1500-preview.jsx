"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { claimWarningDeepLink } from "@/lib/claim-warning-nav";

/**
 * @param {Array<{
 *   sessionId: string,
 *   label: string,
 *   warnings?: string[],
 *   pdfPreviewUrl?: string,
 *   clientId?: string,
 *   locationId?: string,
 *   serviceCode?: string,
 *   payload?: { patient_account_number?: string, lines?: Array<{ procedure_code?: string }> }
 * }>} claims
 */
export default function Cms1500Preview({ claims = [] }) {
  if (!claims.length) return null;

  const pdfPreviewUrl = claims[0]?.pdfPreviewUrl || "";
  const title =
    claims.length === 1
      ? `CMS-1500 — ${claims[0].label}`
      : `CMS-1500 — ${claims.map((c) => c.label).join(", ")}`;

  const warningItems = claims.flatMap((c) => {
    const serviceCode =
      c.serviceCode ||
      c.payload?.lines?.[0]?.procedure_code ||
      "";
    return (c.warnings || []).map((w, idx) => ({
      key: `${c.sessionId}-${idx}-${w}`,
      label: c.label,
      text: w,
      link: claimWarningDeepLink(w, {
        sessionId: c.sessionId,
        clientId: c.clientId,
        locationId: c.locationId,
        serviceCode,
      }),
    }));
  });

  return (
    <div className="space-y-4">
      <Card className="border-slate-300">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          {warningItems.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 mx-4 mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Mapping warnings ({warningItems.length})
                </CardTitle>
                <p className="text-xs text-amber-800/80 font-normal mt-1">
                  Click a warning to open that record/field in a new tab.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {warningItems.map((item) => (
                  <p key={item.key} className="text-sm text-amber-900">
                    <span className="font-medium text-amber-950">{item.label}: </span>
                    {item.link ? (
                      <a
                        href={item.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.link.fixLabel}
                        className="underline decoration-amber-700/50 underline-offset-2 hover:decoration-teal-700 hover:text-teal-800"
                      >
                        {item.text}<ExternalLink className="h-4 w-4 inline-block ml-1" />
                      </a>
                    ) : (
                      item.text
                    )}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <CardContent className="p-4 bg-slate-50">
            {!pdfPreviewUrl ? (
              <div className="rounded-md border bg-white p-4 text-sm text-slate-500">
                Building combined PDF preview...
              </div>
            ) : (
              <div className="rounded-md border bg-white overflow-hidden">
                <iframe
                  src={pdfPreviewUrl}
                  title="CMS-1500 PDF preview"
                  className="w-full h-[980px]"
                />
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              {claims.length > 1
                ? "Scroll in the preview to see each form in order (matches your selected sessions)."
                : "Each claim uses one CMS-1500 (page 1 only)."}
            </p>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
