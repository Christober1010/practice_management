"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Network, Save, PlugZap, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM } from "@/lib/rbac-permission-keys";

const SFTP_FIELDS = [
  { key: "sftp_host", label: "SFTP Host", placeholder: "ftp10.officeally.com" },
  { key: "sftp_port", label: "SFTP Port", placeholder: "22", type: "number" },
  { key: "sftp_user", label: "SFTP Username" },
  { key: "sftp_remote_dir", label: "Upload Folder (claims)", placeholder: "inbound" },
  { key: "sftp_reports_dir", label: "Reports Folder", placeholder: "outbound" },
];

const EDI_FIELDS = [
  { key: "isa_sender_id", label: "ISA Sender ID" },
  { key: "isa_sender_qualifier", label: "ISA Sender Qualifier", placeholder: "ZZ" },
  { key: "isa_receiver_qualifier", label: "ISA Receiver Qualifier", placeholder: "ZZ" },
  { key: "gs_sender_code", label: "GS Sender Code", placeholder: "Defaults to ISA Sender ID" },
  { key: "gs_receiver_code", label: "GS Receiver Code", placeholder: "OA" },
  { key: "submitter_name", label: "Submitter Name" },
  { key: "receiver_id", label: "Receiver ID", placeholder: "330897513" },
  { key: "receiver_name", label: "Receiver Name", placeholder: "OFFICE ALLY" },
  { key: "file_prefix", label: "File Prefix", placeholder: "837P" },
];

const EDITABLE_KEYS = [...SFTP_FIELDS, ...EDI_FIELDS].map((f) => f.key);

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ClearingHouseSettings({ userRole }) {
  const { can } = usePermissions(userRole ?? {});
  const canEdit = can(PERM.BILLING_SFTP);

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const applySettings = (data) => {
    setSettings(data);
    const next = { enabled: !!data.enabled, environment: data.environment || "test" };
    EDITABLE_KEYS.forEach((k) => {
      next[k] = data[k] == null ? "" : String(data[k]);
    });
    setForm(next);
    setPassword("");
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await mahaverseFetch("/clearing-house-settings.php", {
        headers: getMahaverseAuthHeaders(),
      });
      const json = await readJson(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to load clearing house settings");
      }
      applySettings(json.data || {});
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to load clearing house settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const body = { ...form };
      if (password) body.sftp_password = password;
      const res = await mahaverseFetch("/clearing-house-settings.php", {
        method: "PUT",
        headers: getMahaverseAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to save clearing house settings");
      }
      applySettings(json.data || {});
      toast.success("Clearing house settings saved");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save clearing house settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await mahaverseFetch("/officeally-connection-test.php?connect=1", {
        headers: getMahaverseAuthHeaders(),
      });
      const json = await readJson(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Connection test failed");
      }
      toast.success(
        `Connected to ${json.connection?.host || form.sftp_host}:${json.connection?.port || form.sftp_port || 22}`
      );
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const renderField = ({ key, label, placeholder, type }) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={`ch-${key}`}>{label}</Label>
      <Input
        id={`ch-${key}`}
        type={type || "text"}
        value={form[key] ?? ""}
        placeholder={placeholder}
        disabled={!canEdit}
        onChange={(e) => setField(key, e.target.value)}
      />
    </div>
  );

  const passwordHint = !settings?.has_password
    ? "No password set"
    : settings.password_source === "env"
      ? "Using the password from the server .env — enter one to override"
      : "Saved — leave blank to keep it";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-cyan-700" />
            Clearing House
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Office Ally SFTP and EDI 837P settings used when submitting claims.
          </p>
        </div>
        {settings && (
          <Badge
            variant="outline"
            className={
              settings.configured
                ? "border-emerald-300 text-emerald-700"
                : "border-amber-300 text-amber-700"
            }
          >
            {settings.configured ? "Configured" : "Incomplete"}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <>
          {!canEdit && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              View only — editing requires the “Billing: Submit claims via Office Ally SFTP”
              permission.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="ch-enabled"
                  checked={!!form.enabled}
                  disabled={!canEdit}
                  onCheckedChange={(v) => setField("enabled", v)}
                />
                <Label htmlFor="ch-enabled">Office Ally enabled</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select
                  value={form.environment || "test"}
                  disabled={!canEdit}
                  onValueChange={(v) => setField("environment", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SFTP Connection</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SFTP_FIELDS.map(renderField)}
              <div className="space-y-1.5">
                <Label htmlFor="ch-password">SFTP Password</Label>
                <Input
                  id="ch-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  placeholder={settings?.has_password ? "••••••••" : ""}
                  disabled={!canEdit}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-slate-500">{passwordHint}</p>
                {canEdit && !settings?.encryption_available && (
                  <p className="text-xs text-amber-700">
                    Server has no encryption key, so a password can’t be saved here yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">EDI 837P Identifiers</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {EDI_FIELDS.map(renderField)}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {settings?.updated_at
                ? `Last updated ${settings.updated_at}${settings.updated_by ? ` by ${settings.updated_by}` : ""}`
                : "Using server defaults (.env) — nothing saved here yet"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing || !canEdit}>
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !canEdit}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
