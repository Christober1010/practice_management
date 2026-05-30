"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileText } from "lucide-react";

/**
 * @param {Array<{ sessionId: string, label: string, warnings?: string[], pdfPreviewUrl?: string }>} claims
 */
export default function Cms1500Preview({ claims = [] }) {
  if (!claims.length) return null;

  const pdfPreviewUrl = claims[0]?.pdfPreviewUrl || "";
  const title =
    claims.length === 1
      ? `CMS-1500 — ${claims[0].label}`
      : `CMS-1500 — ${claims.map(c => c.label).join(", ")}`
 

  const warningItems = claims.flatMap((c) =>
    (c.warnings || []).map((w, idx) => ({
      key: `${c.sessionId}-${idx}-${w}`,
      label: c.label,
      text: w,
    }))
  );

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

          {warningItems.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 mx-4 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Mapping warnings ({warningItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {warningItems.map((item) => (
                  <p key={item.key} className="text-sm text-amber-900">
                    <span className="font-medium text-amber-950">{item.label}:</span> {item.text}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
}
