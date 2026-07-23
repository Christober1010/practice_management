"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";

export default function AddProviderServiceCodeModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingMapping = null,
}) {
  const isEditing = !!editingMapping;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const [providers, setProviders] = useState([]);
  const [serviceCodes, setServiceCodes] = useState([]);
  const [form, setForm] = useState({
    provider_id: "",
    service_code_id: "",
    unit_duration: "15",
    unit_type: "Minute(s)",
    rate: "",
    status: "Active",
    billable: "Yes",
    authorization_required: "Yes",
  });

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      loadServiceCodes();
    }
  }, [isOpen, baseUrl]);

  useEffect(() => {
    if (isEditing && editingMapping) {
      setForm({
        provider_id: editingMapping.provider_id || "",
        service_code_id: String(editingMapping.service_code_id || ""),
        unit_duration: editingMapping.unit_duration || "15",
        unit_type: editingMapping.unit_type || "Minute(s)",
        rate: editingMapping.rate || "",
        status: editingMapping.status || "Active",
        billable: editingMapping.billable || "Yes",
        authorization_required: editingMapping.authorization_required || "Yes",
      });
    } else {
      setForm({
        provider_id: "",
        service_code_id: "",
        unit_duration: "15",
        unit_type: "Minute(s)",
        rate: "",
        status: "Active",
        billable: "Yes",
        authorization_required: "Yes",
      });
    }
  }, [editingMapping, isEditing, isOpen]);

  const loadProviders = async () => {
    try {
      const res = await mahaverseFetch('/providers.php');
      const data = await res.json();
      if (data?.success) {
        setProviders(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadServiceCodes = async () => {
    try {
      const res = await mahaverseFetch('/service-codes.php');
      const data = await res.json();
      if (data?.success) {
        setServiceCodes(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.provider_id) {
      toast.error("Provider is required");
      return;
    }
    if (!form.service_code_id) {
      toast.error("Service code is required");
      return;
    }

    const payload = {
      ...(isEditing ? { id: editingMapping.id } : {}),
      provider_id: form.provider_id,
      service_code_id: parseInt(form.service_code_id),
      unit_duration: form.unit_duration,
      unit_type: form.unit_type,
      rate: form.rate ? parseFloat(form.rate) : null,
      status: form.status,
      billable: form.billable,
      authorization_required: form.authorization_required,
    };

    try {
      await onAdd(payload);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save mapping");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Provider Service Code Mapping" : "Add Provider Service Code Mapping"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Provider *</Label>
            <Select
              value={form.provider_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, provider_id: value }))}
              disabled={loading || isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers
                  .filter((p) => !p.archived)
                  .map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.provider_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Service Code *</Label>
            <Select
              value={form.service_code_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, service_code_id: value }))}
              disabled={loading || isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service code" />
              </SelectTrigger>
              <SelectContent>
                {serviceCodes.map((code) => (
                  <SelectItem key={code.code_id} value={String(code.code_id)}>
                    {code.code} - {code.code_description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit Duration</Label>
              <Input
                name="unit_duration"
                placeholder="e.g., 15"
                value={form.unit_duration}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Unit Type</Label>
              <Select
                value={form.unit_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, unit_type: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minute(s)">Minute(s)</SelectItem>
                  <SelectItem value="Hour(s)">Hour(s)</SelectItem>
                  <SelectItem value="Per Session">Per Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rate ($)</Label>
            <Input
              name="rate"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.rate}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Billable</Label>
              <Select
                value={form.billable}
                onValueChange={(value) => setForm((prev) => ({ ...prev, billable: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Authorization Required</Label>
              <Select
                value={form.authorization_required}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, authorization_required: value }))
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Saving..." : isEditing ? "Update Mapping" : "Add Mapping"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

