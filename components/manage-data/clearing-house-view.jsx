"use client";

import { useCallback, useEffect, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Server, RotateCw } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM } from "@/lib/rbac-permission-keys";

const EMPTY_FORM = {
  enabled: false,
  sftp_host: "",
  sftp_port: "22",
  sftp_user: "",
  sftp_password: "",
  sftp_remote_dir: "inbound",
  sftp_reports_dir: "outbound",
  isa_sender_id: "",
  isa_sender_qualifier: "ZZ",
  isa_receiver_qualifier: "ZZ",
  gs_sender_code: "",
  gs_receiver_code: "OA",
  submitter_name: "",
  receiver_id: "",
  receiver_name: "OFFICE ALLY",
  file_prefix: "837P",
};

export default function ClearingHouseView({ userRole }) {
  const { can } = usePermissions(userRole);
  const canEdit = can(PERM.MANAGE_DATA_CLEARING_HOUSE);

  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordMasked, setPasswordMasked] = useState("");
  const [effective, setEffective] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mahaverseFetch("/clearing-house.php");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load settings");
      const s = json.settings || {};
      setForm({
        enabled: Boolean(s.enabled),
        sftp_host: s.sftp_host || "",
        sftp_port: String(s.sftp_port ?? 22),
        sftp_user: s.sftp_user || "",
        sftp_password: "",
        sftp_remote_dir: s.sftp_remote_dir || "inbound",
        sftp_reports_dir: s.sftp_reports_dir || "outbound",
        isa_sender_id: s.isa_sender_id || "",
        isa_sender_qualifier: s.isa_sender_qualifier || "ZZ",
        isa_receiver_qualifier: s.isa_receiver_qualifier || "ZZ",
        gs_sender_code: s.gs_sender_code || "",
        gs_receiver_code: s.gs_receiver_code || "OA",
        submitter_name: s.submitter_name || "",
        receiver_id: s.receiver_id || "",
        receiver_name: s.receiver_name || "OFFICE ALLY",
        file_prefix: s.file_prefix || "837P",
      });
      setPasswordSet(Boolean(s.sftp_password_set));
      setPasswordMasked(s.sftp_password_masked || "");
      setUpdatedAt(s.updated_at || null);
      setUpdatedBy(s.updated_by || null);
      setEffective(json.effective || null);
    } catch (e) {
      toast.error(e.message || "Could not load clearing house settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!canEdit) {
      toast.error("You do not have permission to edit clearing house settings.");
      return;
    }
    const port = Number.parseInt(form.sftp_port, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      toast.error("Enter a valid SFTP port (1–65535)");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        enabled: form.enabled,
        sftp_host: form.sftp_host.trim(),
        sftp_port: port,
        sftp_user: form.sftp_user.trim(),
        sftp_remote_dir: form.sftp_remote_dir.trim() || "inbound",
        sftp_reports_dir: form.sftp_reports_dir.trim() || "outbound",
        isa_sender_id: form.isa_sender_id.trim(),
        isa_sender_qualifier: form.isa_sender_qualifier.trim() || "ZZ",
        isa_receiver_qualifier: form.isa_receiver_qualifier.trim() || "ZZ",
        gs_sender_code: form.gs_sender_code.trim(),
        gs_receiver_code: form.gs_receiver_code.trim() || "OA",
        submitter_name: form.submitter_name.trim(),
        receiver_id: form.receiver_id.trim(),
        receiver_name: form.receiver_name.trim() || "OFFICE ALLY",
        file_prefix: form.file_prefix.trim() || "837P",
      };
      if (form.sftp_password.trim() !== "") {
        payload.sftp_password = form.sftp_password;
      }
      const res = await mahaverseFetch("/clearing-house.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to save settings");
      toast.success("Clearing house settings saved");
      await loadSettings();
    } catch (e) {
      toast.error(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <Toaster />
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Clearing House</h2>
        <p className="text-slate-600 mt-1">
          Office Ally SFTP and EDI submitter settings used for claim submission. This is
          the primary configuration — Claims and SFTP tests read from here.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-teal-600" />
            Connection
          </CardTitle>
          <CardDescription>
            Enable integration. Test vs production is set automatically from this server&apos;s
            deployment (OFFICEALLY_ENV).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="clearing-enabled"
              checked={form.enabled}
              disabled={!canEdit || loading}
              onCheckedChange={(checked) => setField("enabled", Boolean(checked))}
            />
            <Label htmlFor="clearing-enabled" className="font-normal cursor-pointer">
              Enable Office Ally claim submission
            </Label>
          </div>
          {effective?.environment ? (
            <p className="text-xs text-slate-500">
              Server environment:{" "}
              <span className="font-medium text-slate-700">{effective.environment}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">SFTP</CardTitle>
          <CardDescription>Mailbox credentials and folders for 837P uploads.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sftp-host">Host</Label>
            <Input
              id="sftp-host"
              value={form.sftp_host}
              disabled={!canEdit || loading}
              placeholder="ftp10.officeally.com"
              onChange={(e) => setField("sftp_host", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sftp-port">Port</Label>
            <Input
              id="sftp-port"
              type="number"
              min={1}
              max={65535}
              value={form.sftp_port}
              disabled={!canEdit || loading}
              onChange={(e) => setField("sftp_port", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sftp-user">Username</Label>
            <Input
              id="sftp-user"
              value={form.sftp_user}
              disabled={!canEdit || loading}
              autoComplete="off"
              onChange={(e) => setField("sftp_user", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sftp-password">Password</Label>
            <Input
              id="sftp-password"
              type="password"
              value={form.sftp_password}
              disabled={!canEdit || loading}
              autoComplete="new-password"
              placeholder={
                passwordSet
                  ? `Saved (${passwordMasked || "••••"}) — leave blank to keep`
                  : "Enter SFTP password"
              }
              onChange={(e) => setField("sftp_password", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sftp-inbound">Inbound folder</Label>
            <Input
              id="sftp-inbound"
              value={form.sftp_remote_dir}
              disabled={!canEdit || loading}
              onChange={(e) => setField("sftp_remote_dir", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sftp-outbound">Reports folder</Label>
            <Input
              id="sftp-outbound"
              value={form.sftp_reports_dir}
              disabled={!canEdit || loading}
              onChange={(e) => setField("sftp_reports_dir", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">EDI / submitter</CardTitle>
          <CardDescription>
            ISA/GS identifiers embedded in generated 837P files.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="isa-sender">ISA sender ID (submitter / tax ID)</Label>
            <Input
              id="isa-sender"
              value={form.isa_sender_id}
              disabled={!canEdit || loading}
              onChange={(e) => setField("isa_sender_id", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gs-sender">GS sender code</Label>
            <Input
              id="gs-sender"
              value={form.gs_sender_code}
              disabled={!canEdit || loading}
              placeholder="Defaults to ISA sender ID if empty"
              onChange={(e) => setField("gs_sender_code", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiver-id">Receiver ID</Label>
            <Input
              id="receiver-id"
              value={form.receiver_id}
              disabled={!canEdit || loading}
              onChange={(e) => setField("receiver_id", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="submitter-name">Submitter name</Label>
            <Input
              id="submitter-name"
              value={form.submitter_name}
              disabled={!canEdit || loading}
              onChange={(e) => setField("submitter_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiver-name">Receiver name</Label>
            <Input
              id="receiver-name"
              value={form.receiver_name}
              disabled={!canEdit || loading}
              onChange={(e) => setField("receiver_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-prefix">File prefix</Label>
            <Input
              id="file-prefix"
              value={form.file_prefix}
              disabled={!canEdit || loading}
              onChange={(e) => setField("file_prefix", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {effective ? (
        <p className="text-xs text-slate-500 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          Effective: {effective.enabled ? "enabled" : "disabled"} · {effective.environment} ·{" "}
          {effective.sftp_host || "—"}:{effective.sftp_port}
          {effective.configured ? " · ready" : " · incomplete (check SFTP + ISA sender ID)"}
        </p>
      ) : null}

      {updatedAt ? (
        <p className="text-xs text-slate-500">
          Last saved {new Date(updatedAt).toLocaleString()}
          {updatedBy ? ` by ${updatedBy}` : ""}
          {updatedBy === "env-import" ? " (imported from server env on first use)" : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={loadSettings} disabled={loading || saving}>
          <RotateCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        {canEdit ? (
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={saveSettings}
            disabled={loading || saving}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        ) : (
          <p className="text-sm text-slate-500 self-center">
            View only — ask an admin for Clearing House edit access.
          </p>
        )}
      </div>
    </div>
  );
}
