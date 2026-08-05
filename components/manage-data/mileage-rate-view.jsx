"use client";

import { useCallback, useEffect, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, RotateCw } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function MileageRateView() {
  const [rateDraft, setRateDraft] = useState("0.45");
  const [savedRate, setSavedRate] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mahaverseFetch("/mileage.php?action=settings");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load rate");
      const r = Number(json.settings?.rate_per_mile ?? 0.45);
      setSavedRate(r);
      setRateDraft(String(r));
      setUpdatedAt(json.settings?.updated_at || null);
      setUpdatedBy(json.settings?.updated_by || null);
    } catch (e) {
      toast.error(e.message || "Could not load mileage rate");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveRate = async () => {
    const n = parseFloat(rateDraft);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Enter a rate between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      const res = await mahaverseFetch("/mileage.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settings", rate_per_mile: n }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to save rate");
      const r = Number(json.settings?.rate_per_mile ?? n);
      setSavedRate(r);
      setRateDraft(String(r));
      setUpdatedAt(json.settings?.updated_at || null);
      setUpdatedBy(json.settings?.updated_by || null);
      toast.success(`Rate saved: $${r.toFixed(2)} / mile`);
    } catch (e) {
      toast.error(e.message || "Failed to save rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      <Toaster />
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Mileage Rate</h2>
        <p className="text-slate-600 mt-1">
          Organization reimbursement rate used when submitting mileage claims.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-teal-700" />
            Rate per mile
          </CardTitle>
          <CardDescription>
            Claims snapshot this rate at submit time. Changing it does not rewrite past claims.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mileage-rate">USD per mile</Label>
            <div className="relative max-w-[10rem]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
              <Input
                id="mileage-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="pl-7"
                value={rateDraft}
                disabled={loading || saving}
                onChange={(e) => setRateDraft(e.target.value)}
              />
            </div>
          </div>

          {savedRate != null && !loading ? (
            <p className="text-sm text-slate-500">
              Current: <span className="font-medium text-slate-700">${Number(savedRate).toFixed(2)}</span>
              {updatedAt ? (
                <>
                  {" · "}updated {updatedAt}
                  {updatedBy ? ` by ${updatedBy}` : ""}
                </>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={saveRate}
              disabled={loading || saving}
            >
              {saving ? "Saving…" : "Save rate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={loadSettings}
              disabled={loading || saving}
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
