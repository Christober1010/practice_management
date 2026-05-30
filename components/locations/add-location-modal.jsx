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
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";
import toast from "react-hot-toast";

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];
const US_STATES_SET = new Set(US_STATES);

const TIME_ZONES = [
  'America/New_York (EST/EDT)',
  'America/Chicago (CST/CDT)',
  'America/Denver (MST/MDT)',
  'America/Los_Angeles (PST/PDT)',
  'America/Phoenix (MST)',
  'America/Anchorage (AKST/AKDT)',
  'Pacific/Honolulu (HST)'
];

export default function AddLocationModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingLocation = null,
}) {
  const isEditing = !!editingLocation;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [activeTab, setActiveTab] = useState("general");
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loadingFacilityTypes, setLoadingFacilityTypes] = useState(false);
  const tabOrder = ["general", "facility", "billing"];

  const [form, setForm] = useState({
    // General Office Information
    tax_id_professional: "",
    office_phone_number: "",
    office_phone_ext: "",
    time_zone: "",
    start_time: "",
    end_time: "",
    location_name: "",
    location_description: "",
    
    // Facility Service Location Information / Box 32
    facility_type: "",
    facility_npi_number: "",
    facility_name: "",
    facility_address: "",
    facility_apt_unit: "",
    facility_country: "US",
    facility_city: "",
    facility_state: "",
    facility_zip_code: "",
    
    // Billing Provider Information / Box 33
    taxonomy_code: "",
    billing_npi_number: "",
    billing_provider_name: "",
    billing_address: "",
    billing_apt_unit: "",
    billing_country: "US",
    billing_city: "",
    billing_state: "",
    billing_zip_code: "",
    
    status: "Active",
  });

  useEffect(() => {
    if (isEditing && editingLocation) {
      setForm({
        tax_id_professional: editingLocation.tax_id_professional || "",
        office_phone_number: editingLocation.office_phone_number || "",
        office_phone_ext: editingLocation.office_phone_ext || "",
        time_zone: editingLocation.time_zone || "",
        start_time: editingLocation.start_time || "",
        end_time: editingLocation.end_time || "",
        location_name: editingLocation.location_name || "",
        location_description: editingLocation.location_description || "",
        facility_type: editingLocation.facility_type || "",
        facility_npi_number: editingLocation.facility_npi_number || "",
        facility_name: editingLocation.facility_name || "",
        facility_address: editingLocation.facility_address || "",
        facility_apt_unit: editingLocation.facility_apt_unit || "",
        facility_country: editingLocation.facility_country || "US",
        facility_city: editingLocation.facility_city || "",
        facility_state: editingLocation.facility_state || "",
        facility_zip_code: editingLocation.facility_zip_code || "",
        taxonomy_code: editingLocation.taxonomy_code || "",
        billing_npi_number: editingLocation.billing_npi_number || "",
        billing_provider_name: editingLocation.billing_provider_name || "",
        billing_address: editingLocation.billing_address || "",
        billing_apt_unit: editingLocation.billing_apt_unit || "",
        billing_country: editingLocation.billing_country || "US",
        billing_city: editingLocation.billing_city || "",
        billing_state: editingLocation.billing_state || "",
        billing_zip_code: editingLocation.billing_zip_code || "",
        status: editingLocation.status || "Active",
      });
    } else {
      setForm({
        tax_id_professional: "",
        office_phone_number: "",
        office_phone_ext: "",
        time_zone: "",
        start_time: "",
        end_time: "",
        location_name: "",
        location_description: "",
        facility_type: "",
        facility_npi_number: "",
        facility_name: "",
        facility_address: "",
        facility_apt_unit: "",
        facility_country: "US",
        facility_city: "",
        facility_state: "",
        facility_zip_code: "",
        taxonomy_code: "",
        billing_npi_number: "",
        billing_provider_name: "",
        billing_address: "",
        billing_apt_unit: "",
        billing_country: "US",
        billing_city: "",
        billing_state: "",
        billing_zip_code: "",
        status: "Active",
      });
    }
  }, [editingLocation, isEditing, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("general");
    }
  }, [isOpen, editingLocation]);

  // Load facility types from API
  useEffect(() => {
    const loadFacilityTypes = async () => {
      if (!baseUrl) return;
      try {
        setLoadingFacilityTypes(true);
        const res = await mahaverseFetch('/facility-types.php?activeOnly=true');
        const data = await res.json();
        if (data?.success) {
          setFacilityTypes(data.data || []);
        } else {
          console.error("Failed to load facility types:", data?.message);
          toast.error("Failed to load facility types");
        }
      } catch (err) {
        console.error("Error loading facility types:", err);
        toast.error("Failed to load facility types");
      } finally {
        setLoadingFacilityTypes(false);
      }
    };

    if (isOpen) {
      loadFacilityTypes();
    }
  }, [baseUrl, isOpen]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const mapCountryCode = (countryShort) => {
    const map = { us: "US", ca: "CA", mx: "MX" };
    return map[(countryShort || "").toLowerCase()] || "US";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!form.tax_id_professional?.trim()) {
      toast.error("Tax ID is required");
      return;
    }
    if (!form.office_phone_number?.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!form.location_name?.trim()) {
      toast.error("Location name is required");
      return;
    }
    if (!form.facility_type) {
      toast.error("Facility type is required");
      return;
    }
    if (!form.facility_npi_number?.trim()) {
      toast.error("Facility NPI Number is required");
      return;
    }
    if (!form.facility_name?.trim()) {
      toast.error("Facility name is required");
      return;
    }
    if (!form.facility_address?.trim()) {
      toast.error("Facility address is required");
      return;
    }
    if (!form.facility_country) {
      toast.error("Facility country is required");
      return;
    }
    if (!form.facility_city?.trim()) {
      toast.error("Facility city is required");
      return;
    }
    if (!form.facility_state) {
      toast.error("Facility state is required");
      return;
    }
    if (!form.facility_zip_code?.trim()) {
      toast.error("Facility zip code is required");
      return;
    }
    if (!form.taxonomy_code) {
      toast.error("Taxonomy code is required");
      return;
    }

    const payload = {
      ...(isEditing ? { id: editingLocation.id } : {}),
      ...form,
    };

    try {
      await onAdd(payload);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save location");
    }
  };

  const handleTabNext = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  const handleTabBack = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const descriptionLength = form.location_description?.length || 0;
  const remainingChars = 1000 - descriptionLength;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Location" : "Add New Location"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General Office</TabsTrigger>
              <TabsTrigger value="facility">Facility Location</TabsTrigger>
              <TabsTrigger value="billing">Billing Provider</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                General Office Information
                <Badge variant="destructive" className="ml-2">Required</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax_id_professional">Tax ID #(Professional) *</Label>
                  <Input
                    id="tax_id_professional"
                    value={form.tax_id_professional}
                    onChange={(e) => handleChange("tax_id_professional", e.target.value)}
                    placeholder="Enter Tax ID"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="office_phone_number">Phone Number *</Label>
                    <Input
                      id="office_phone_number"
                      type="tel"
                      value={form.office_phone_number}
                      onChange={(e) => handleChange("office_phone_number", e.target.value)}
                      placeholder="Phone Number"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="office_phone_ext">Ext.</Label>
                    <Input
                      id="office_phone_ext"
                      value={form.office_phone_ext}
                      onChange={(e) => handleChange("office_phone_ext", e.target.value)}
                      placeholder="Ext."
                      disabled={loading}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="time_zone">Time Zone</Label>
                  <Select
                    value={form.time_zone}
                    onValueChange={(value) => handleChange("time_zone", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="time_zone">
                      <SelectValue placeholder="Select time zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={form.start_time}
                      onChange={(e) => handleChange("start_time", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={(e) => handleChange("end_time", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="location_name">
                    Location Name (Used for internal purposes only. Will not be displayed on claim) *
                  </Label>
                  <Input
                    id="location_name"
                    value={form.location_name}
                    onChange={(e) => handleChange("location_name", e.target.value)}
                    placeholder="Enter location name"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="location_description">Description</Label>
                  <Textarea
                    id="location_description"
                    rows={4}
                    value={form.location_description}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 1000) {
                        handleChange("location_description", value);
                      }
                    }}
                    placeholder="Enter description..."
                    maxLength={1000}
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {remainingChars} Characters Remaining
                  </p>
                </div>
              </div>
            </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="facility" className="space-y-6">
              <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-teal-600" />
                Facility Service Location Information / Box 32
                <Badge variant="destructive" className="ml-2">Required</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r text-sm text-blue-800">
                <strong>Note:</strong> Mahaverse will use this address in Box 32 of the claim form if POS 11 is selected. If the service address is home (POS 12) or another location then Mahaverse will display that address in Box 32.
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="facility_type">Facility Type *</Label>
                  <Select
                    value={form.facility_type}
                    onValueChange={(value) => handleChange("facility_type", value)}
                    disabled={loading || loadingFacilityTypes}
                  >
                    <SelectTrigger id="facility_type">
                      <SelectValue placeholder={loadingFacilityTypes ? "Loading..." : "Select facility type..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {facilityTypes.map((ft) => (
                        <SelectItem key={ft.id} value={ft.pos_code}>
                          {ft.pos_code} - {ft.facility_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="facility_npi_number">Facility NPI Number (Box 32a) *</Label>
                  <Input
                    id="facility_npi_number"
                    value={form.facility_npi_number}
                    onChange={(e) => handleChange("facility_npi_number", e.target.value)}
                    placeholder="Enter Facility NPI Number"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="facility_name">Facility Name (Name of Business) *</Label>
                  <Input
                    id="facility_name"
                    value={form.facility_name}
                    onChange={(e) => handleChange("facility_name", e.target.value)}
                    placeholder="Enter facility name"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="facility_address">Address *</Label>
                  <AddressAutocomplete
                    id="facility_address"
                    value={form.facility_address}
                    onChange={(value) => handleChange("facility_address", value)}
                    onAddressSelect={(addr) =>
                      setForm((prev) => ({
                        ...prev,
                        facility_address: addr.addressLine1 || addr.formattedAddress || prev.facility_address,
                        facility_city: addr.locality || prev.facility_city,
                        facility_state:
                          addr.administrativeAreaShort && US_STATES_SET.has(addr.administrativeAreaShort)
                            ? addr.administrativeAreaShort
                            : prev.facility_state,
                        facility_zip_code: addr.postalCode || prev.facility_zip_code,
                        facility_country: addr.countryShort
                          ? mapCountryCode(addr.countryShort)
                          : prev.facility_country,
                      }))
                    }
                    countryRestrictions={["us", "ca", "mx"]}
                    placeholder="Start typing to search address..."
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="facility_apt_unit">Apt/Unit</Label>
                  <Input
                    id="facility_apt_unit"
                    value={form.facility_apt_unit}
                    onChange={(e) => handleChange("facility_apt_unit", e.target.value)}
                    placeholder="Apt/Unit (Optional)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="facility_country">Country *</Label>
                  <Select
                    value={form.facility_country}
                    onValueChange={(value) => handleChange("facility_country", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="facility_country">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">US</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="facility_city">City *</Label>
                  <Input
                    id="facility_city"
                    value={form.facility_city}
                    onChange={(e) => handleChange("facility_city", e.target.value)}
                    placeholder="Enter city"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="facility_state">State *</Label>
                  <Select
                    value={form.facility_state}
                    onValueChange={(value) => handleChange("facility_state", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="facility_state">
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="facility_zip_code">Zip Code *</Label>
                  <Input
                    id="facility_zip_code"
                    value={form.facility_zip_code}
                    onChange={(e) => handleChange("facility_zip_code", e.target.value)}
                    placeholder="Enter zip code"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                Billing Provider Information / Box 33
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r text-sm text-blue-800 italic">
                <strong>Note:</strong> If left blank, Mahaverse will use the Facility Service Location Information in Box 32. If your payer requires a taxonomy code in Box 33b please enter it below.
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxonomy_code">Taxonomy Codes *</Label>
                  <Select
                    value={form.taxonomy_code}
                    onValueChange={(value) => handleChange("taxonomy_code", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="taxonomy_code">
                      <SelectValue placeholder="Select taxonomy code..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="235Z00000X">235Z00000X - Speech-Language Pathologist</SelectItem>
                      <SelectItem value="225Z00000X">225Z00000X - Occupational Therapist</SelectItem>
                      <SelectItem value="225100000X">225100000X - Physical Therapist</SelectItem>
                      <SelectItem value="103K00000X">103K00000X - Behavior Analyst</SelectItem>
                      <SelectItem value="103T00000X">103T00000X - Psychologist</SelectItem>
                      <SelectItem value="106H00000X">106H00000X - Marriage & Family Therapist</SelectItem>
                      <SelectItem value="106S00000X">106S00000X - Social Worker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="billing_npi_number">Billing NPI Number / Box 33a</Label>
                  <Input
                    id="billing_npi_number"
                    value={form.billing_npi_number}
                    onChange={(e) => handleChange("billing_npi_number", e.target.value)}
                    placeholder="Enter Billing NPI Number"
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="billing_provider_name">Billing Provider Name</Label>
                  <Input
                    id="billing_provider_name"
                    value={form.billing_provider_name}
                    onChange={(e) => handleChange("billing_provider_name", e.target.value)}
                    placeholder="Enter billing provider name"
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="billing_address">Address</Label>
                  <AddressAutocomplete
                    id="billing_address"
                    value={form.billing_address}
                    onChange={(value) => handleChange("billing_address", value)}
                    onAddressSelect={(addr) =>
                      setForm((prev) => ({
                        ...prev,
                        billing_address: addr.addressLine1 || addr.formattedAddress || prev.billing_address,
                        billing_city: addr.locality || prev.billing_city,
                        billing_state:
                          addr.administrativeAreaShort && US_STATES_SET.has(addr.administrativeAreaShort)
                            ? addr.administrativeAreaShort
                            : prev.billing_state,
                        billing_zip_code: addr.postalCode || prev.billing_zip_code,
                        billing_country: addr.countryShort
                          ? mapCountryCode(addr.countryShort)
                          : prev.billing_country,
                      }))
                    }
                    countryRestrictions={["us", "ca", "mx"]}
                    placeholder="Start typing to search address..."
                    disabled={loading}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="billing_apt_unit">Apt/Unit</Label>
                  <Input
                    id="billing_apt_unit"
                    value={form.billing_apt_unit}
                    onChange={(e) => handleChange("billing_apt_unit", e.target.value)}
                    placeholder="Apt/Unit (Optional)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="billing_country">Country</Label>
                  <Select
                    value={form.billing_country}
                    onValueChange={(value) => handleChange("billing_country", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="billing_country">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">US</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    value={form.billing_city}
                    onChange={(e) => handleChange("billing_city", e.target.value)}
                    placeholder="Enter city"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="billing_state">State</Label>
                  <Select
                    value={form.billing_state}
                    onValueChange={(value) => handleChange("billing_state", value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="billing_state">
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="billing_zip_code">Zip Code</Label>
                  <Input
                    id="billing_zip_code"
                    value={form.billing_zip_code}
                    onChange={(e) => handleChange("billing_zip_code", e.target.value)}
                    placeholder="Enter zip code"
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between gap-2 pt-4">
            <div className="flex gap-2">
              {activeTab !== "general" && (
                <Button type="button" variant="outline" onClick={handleTabBack} disabled={loading}>
                  Back
                </Button>
              )}
              {activeTab !== "billing" && (
                <Button type="button" onClick={handleTabNext} className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
                  Next
                </Button>
              )}
            </div>
            <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update Location" : "Save Location"}
            </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
