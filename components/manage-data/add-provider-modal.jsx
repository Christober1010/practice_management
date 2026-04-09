"use client";

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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";

function generateId() {
  return `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function AddProviderModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingProvider = null,
}) {
  const isEditing = !!editingProvider;

  const [form, setForm] = useState({
    provider_name: "",
    provider_code: "",
    email: "",
    phone: "",
    fax: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    zip_code: "",
    status: "Active",
  });

  useEffect(() => {
    if (isEditing && editingProvider) {
      setForm({
        provider_name: editingProvider.provider_name || "",
        provider_code: editingProvider.provider_code || "",
        email: editingProvider.email || "",
        phone: editingProvider.phone || "",
        fax: editingProvider.fax || "",
        address1: editingProvider.address1 || "",
        address2: editingProvider.address2 || "",
        city: editingProvider.city || "",
        state: editingProvider.state || "",
        country: editingProvider.country || "",
        zip_code: editingProvider.zip_code || "",
        status: editingProvider.status || "Active",
      });
    } else {
      setForm({
        provider_name: "",
        provider_code: "",
        email: "",
        phone: "",
        fax: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        country: "",
        zip_code: "",
        status: "Active",
      });
    }
  }, [editingProvider, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.provider_name.trim()) {
      toast.error("Provider name is required");
      return;
    }

    const payload = {
      ...(isEditing ? { id: editingProvider.id } : {}),
      ...form,
    };

    try {
      await onAdd(payload);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save provider");
    }
  };

  const mapCountryFromShort = (countryShort, countryLong) => {
    if (!countryShort && !countryLong) return "";
    const map = {
      us: "USA",
      ca: "Canada",
      gb: "United Kingdom",
      au: "Australia",
      de: "Germany",
      fr: "France",
      it: "Italy",
      es: "Spain",
      nl: "Netherlands",
      mx: "Mexico",
      in: "India",
    };
    return map[(countryShort || "").toLowerCase()] || countryLong || "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Provider" : "Add New Provider"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider Name *</Label>
              <Input
                name="provider_name"
                placeholder="Provider Name"
                value={form.provider_name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Provider ID</Label>
              <Input
                name="provider_code"
                placeholder="Provider ID"
                value={form.provider_code}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                name="phone"
                placeholder="Phone"
                value={form.phone}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Fax</Label>
              <Input
                name="fax"
                placeholder="Fax"
                value={form.fax}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Address 1</Label>
              <AddressAutocomplete
                id="provider-address-1"
                debug={process.env.NODE_ENV === "development"}
                name="address1"
                placeholder="Address 1"
                value={form.address1}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, address1: value }))
                }
                onAddressSelect={(addr) =>
                  setForm((prev) => ({
                    ...prev,
                    address1: addr.addressLine1 || addr.formattedAddress || prev.address1,
                    city: addr.locality || prev.city,
                    state: addr.administrativeAreaShort || prev.state,
                    zip_code: addr.postalCode || prev.zip_code,
                    country: mapCountryFromShort(addr.countryShort, addr.country) || prev.country,
                  }))
                }
                countryRestrictions={["us", "ca", "gb", "au", "de", "fr", "it", "es", "nl", "mx", "in"]}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Address 2</Label>
              <Input
                name="address2"
                placeholder="Address 2"
                value={form.address2}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                name="city"
                placeholder="City"
                value={form.city}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                name="state"
                placeholder="State"
                value={form.state}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                name="country"
                placeholder="Country"
                value={form.country}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Zip Code</Label>
              <Input
                name="zip_code"
                placeholder="Zip Code"
                value={form.zip_code}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value }))
                  }
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
          </div>

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
              {loading ? "Saving..." : isEditing ? "Update Provider" : "Add Provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

