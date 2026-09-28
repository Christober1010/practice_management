'use client';

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useState, useEffect } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2 } from 'lucide-react';

interface LocationStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const TIME_ZONES = [
  'America/New_York (EST/EDT)',
  'America/Chicago (CST/CDT)',
  'America/Denver (MST/MDT)',
  'America/Los_Angeles (PST/PDT)',
  'America/Phoenix (MST)',
  'America/Anchorage (AKST/AKDT)',
  'Pacific/Honolulu (HST)'
];

export default function LocationStep({ formData, updateField, onNext, onBack }: LocationStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loadingFacilityTypes, setLoadingFacilityTypes] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

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
        }
      } catch (err) {
        console.error("Error loading facility types:", err);
      } finally {
        setLoadingFacilityTypes(false);
      }
    };

    loadFacilityTypes();
  }, [baseUrl]);
  
  // Validation checks
  const missingTaxId = !formData.taxIdProfessional?.trim();
  const missingOfficePhone = !formData.officePhoneNumber?.trim();
  const missingLocationName = !formData.locationName?.trim();
  const missingFacilityType = !formData.facilityType;
  const missingFacilityNpi = !formData.facilityNpiNumber?.trim();
  const missingFacilityName = !formData.facilityName?.trim();
  const missingFacilityAddress = !formData.facilityAddress?.trim();
  const missingFacilityCountry = !formData.facilityCountry;
  const missingFacilityCity = !formData.facilityCity?.trim();
  const missingFacilityState = !formData.facilityState;
  const missingFacilityZip = !formData.facilityZipCode?.trim();
  const missingTaxonomyCode = !formData.taxonomyCode;
  
  const hasErrors =
    missingTaxId ||
    missingOfficePhone ||
    missingLocationName ||
    missingFacilityType ||
    missingFacilityNpi ||
    missingFacilityName ||
    missingFacilityAddress ||
    missingFacilityCountry ||
    missingFacilityCity ||
    missingFacilityState ||
    missingFacilityZip ||
    missingTaxonomyCode;

  const handleNextClick = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onNext();
  };

  const descriptionLength = formData.locationDescription?.length || 0;
  const remainingChars = 1000 - descriptionLength;

  return (
    <section className="section-transition">
      <div className="space-y-6">
        {/* General Office Information */}
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
                <Label htmlFor="taxIdProfessional">Tax ID #(Professional) *</Label>
                <Input
                  id="taxIdProfessional"
                  type="text"
                  value={formData.taxIdProfessional || ''}
                  onChange={(e) => updateField('taxIdProfessional', e.target.value)}
                  placeholder="Enter Tax ID"
                  required
                  className={
                    showErrors && missingTaxId
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.taxIdProfessional
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingTaxId && (
                  <p className="text-red-500 text-xs mt-1">Tax ID is required</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="officePhoneNumber">Phone Number *</Label>
                  <Input
                    id="officePhoneNumber"
                    type="tel"
                    value={formData.officePhoneNumber || ''}
                    onChange={(e) => updateField('officePhoneNumber', e.target.value)}
                    placeholder="Phone Number"
                    required
                    className={
                      showErrors && missingOfficePhone
                        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                        : !formData.officePhoneNumber
                        ? "border-teal-500"
                        : ""
                    }
                  />
                  {showErrors && missingOfficePhone && (
                    <p className="text-red-500 text-xs mt-1">Phone number is required</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="officePhoneExt">Ext.</Label>
                  <Input
                    id="officePhoneExt"
                    type="text"
                    value={formData.officePhoneExt || ''}
                    onChange={(e) => updateField('officePhoneExt', e.target.value)}
                    placeholder="Ext."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select
                  value={formData.timeZone || ''}
                  onValueChange={(value) => updateField('timeZone', value)}
                >
                  <SelectTrigger id="timeZone">
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
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime || ''}
                    onChange={(e) => updateField('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime || ''}
                    onChange={(e) => updateField('endTime', e.target.value)}
                  />
                </div>
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="locationName">
                  Location Name (Used for internal purposes only. Will not be displayed on claim) *
                </Label>
                <Input
                  id="locationName"
                  type="text"
                  value={formData.locationName || ''}
                  onChange={(e) => updateField('locationName', e.target.value)}
                  placeholder="Enter location name"
                  required
                  className={
                    showErrors && missingLocationName
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.locationName
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingLocationName && (
                  <p className="text-red-500 text-xs mt-1">Location name is required</p>
                )}
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="locationDescription">Description</Label>
                <Textarea
                  id="locationDescription"
                  rows={4}
                  value={formData.locationDescription || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 1000) {
                      updateField('locationDescription', value);
                    }
                  }}
                  placeholder="Enter description..."
                  maxLength={1000}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {remainingChars} Characters Remaining
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facility Service Location Information / Box 32 */}
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
                <Label htmlFor="facilityType">Facility Type *</Label>
                <Select
                  value={formData.facilityType || ''}
                  onValueChange={(value) => updateField('facilityType', value)}
                  disabled={loadingFacilityTypes}
                >
                  <SelectTrigger id="facilityType">
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
                {showErrors && missingFacilityType && (
                  <p className="text-red-500 text-xs mt-1">Facility type is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="facilityNpiNumber">Facility NPI Number (Box 32a) *</Label>
                <Input
                  id="facilityNpiNumber"
                  type="text"
                  value={formData.facilityNpiNumber || ''}
                  onChange={(e) => updateField('facilityNpiNumber', e.target.value)}
                  placeholder="Enter Facility NPI Number"
                  required
                  className={
                    showErrors && missingFacilityNpi
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.facilityNpiNumber
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingFacilityNpi && (
                  <p className="text-red-500 text-xs mt-1">Facility NPI Number is required</p>
                )}
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="facilityName">Facility Name (Name of Business) *</Label>
                <Input
                  id="facilityName"
                  type="text"
                  value={formData.facilityName || ''}
                  onChange={(e) => updateField('facilityName', e.target.value)}
                  placeholder="Enter facility name"
                  required
                  className={
                    showErrors && missingFacilityName
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.facilityName
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingFacilityName && (
                  <p className="text-red-500 text-xs mt-1">Facility name is required</p>
                )}
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="facilityAddress">Address *</Label>
                <AddressAutocomplete
                  id="facilityAddress"
                  debug={process.env.NODE_ENV === 'development'}
                  value={formData.facilityAddress || ''}
                  onChange={(v) => updateField('facilityAddress', v)}
                  onAddressSelect={(addr) => {
                    updateField('facilityAddress', addr.addressLine1 || addr.formattedAddress);
                    if (addr.locality) updateField('facilityCity', addr.locality);
                    if (addr.administrativeAreaShort) updateField('facilityState', addr.administrativeAreaShort);
                    if (addr.postalCode) updateField('facilityZipCode', addr.postalCode);
                    if (addr.countryShort) {
                      const map: Record<string, string> = { us: 'US', ca: 'CA', mx: 'MX' };
                      updateField('facilityCountry', map[addr.countryShort.toLowerCase()] || 'US');
                    }
                  }}
                  countryRestrictions={['us', 'ca', 'mx']}
                  placeholder="Start typing to search address..."
                  required
                  className={
                    showErrors && missingFacilityAddress
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.facilityAddress
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingFacilityAddress && (
                  <p className="text-red-500 text-xs mt-1">Address is required</p>
                )}
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="facilityAptUnit">Apt/Unit</Label>
                <Input
                  id="facilityAptUnit"
                  type="text"
                  value={formData.facilityAptUnit || ''}
                  onChange={(e) => updateField('facilityAptUnit', e.target.value)}
                  placeholder="Apt/Unit (Optional)"
                />
              </div>
              <div>
                <Label htmlFor="facilityCountry">Country *</Label>
                <Select
                  value={formData.facilityCountry || 'US'}
                  onValueChange={(value) => updateField('facilityCountry', value)}
                >
                  <SelectTrigger id="facilityCountry">
                    <SelectValue placeholder="Select country..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="MX">Mexico</SelectItem>
                  </SelectContent>
                </Select>
                {showErrors && missingFacilityCountry && (
                  <p className="text-red-500 text-xs mt-1">Country is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="facilityCity">City *</Label>
                <Input
                  id="facilityCity"
                  type="text"
                  value={formData.facilityCity || ''}
                  onChange={(e) => updateField('facilityCity', e.target.value)}
                  placeholder="Enter city"
                  required
                  className={
                    showErrors && missingFacilityCity
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.facilityCity
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingFacilityCity && (
                  <p className="text-red-500 text-xs mt-1">City is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="facilityState">State *</Label>
                <Select
                  value={formData.facilityState || ''}
                  onValueChange={(value) => updateField('facilityState', value)}
                >
                  <SelectTrigger id="facilityState">
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
                {showErrors && missingFacilityState && (
                  <p className="text-red-500 text-xs mt-1">State is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="facilityZipCode">Zip Code *</Label>
                <Input
                  id="facilityZipCode"
                  type="text"
                  value={formData.facilityZipCode || ''}
                  onChange={(e) => updateField('facilityZipCode', e.target.value)}
                  placeholder="Enter zip code"
                  required
                  className={
                    showErrors && missingFacilityZip
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.facilityZipCode
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingFacilityZip && (
                  <p className="text-red-500 text-xs mt-1">Zip code is required</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Provider Information / Box 33 */}
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
                <Label htmlFor="taxonomyCode">Taxonomy Codes *</Label>
                <Select
                  value={formData.taxonomyCode || ''}
                  onValueChange={(value) => updateField('taxonomyCode', value)}
                >
                  <SelectTrigger id="taxonomyCode">
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
                {showErrors && missingTaxonomyCode && (
                  <p className="text-red-500 text-xs mt-1">Taxonomy code is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="billingNpiNumber">Billing NPI Number / Box 33a</Label>
                <Input
                  id="billingNpiNumber"
                  type="text"
                  value={formData.billingNpiNumber || ''}
                  onChange={(e) => updateField('billingNpiNumber', e.target.value)}
                  placeholder="Enter Billing NPI Number"
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="billingProviderName">Billing Provider Name</Label>
                <Input
                  id="billingProviderName"
                  type="text"
                  value={formData.billingProviderName || ''}
                  onChange={(e) => updateField('billingProviderName', e.target.value)}
                  placeholder="Enter billing provider name"
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="billingAddress">Address</Label>
                <AddressAutocomplete
                  id="billingAddress"
                  debug={process.env.NODE_ENV === 'development'}
                  value={formData.billingAddress || ''}
                  onChange={(v) => updateField('billingAddress', v)}
                  onAddressSelect={(addr) => {
                    updateField('billingAddress', addr.addressLine1 || addr.formattedAddress);
                    if (addr.locality) updateField('billingCity', addr.locality);
                    if (addr.administrativeAreaShort) updateField('billingState', addr.administrativeAreaShort);
                    if (addr.postalCode) updateField('billingZipCode', addr.postalCode);
                    if (addr.countryShort) {
                      const map: Record<string, string> = { us: 'US', ca: 'CA', mx: 'MX' };
                      updateField('billingCountry', map[addr.countryShort.toLowerCase()] || 'US');
                    }
                  }}
                  countryRestrictions={['us', 'ca', 'mx']}
                  placeholder="Start typing to search address..."
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="billingAptUnit">Apt/Unit</Label>
                <Input
                  id="billingAptUnit"
                  type="text"
                  value={formData.billingAptUnit || ''}
                  onChange={(e) => updateField('billingAptUnit', e.target.value)}
                  placeholder="Apt/Unit (Optional)"
                />
              </div>
              <div>
                <Label htmlFor="billingCountry">Country</Label>
                <Select
                  value={formData.billingCountry || 'US'}
                  onValueChange={(value) => updateField('billingCountry', value)}
                >
                  <SelectTrigger id="billingCountry">
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
                <Label htmlFor="billingCity">City</Label>
                <Input
                  id="billingCity"
                  type="text"
                  value={formData.billingCity || ''}
                  onChange={(e) => updateField('billingCity', e.target.value)}
                  placeholder="Enter city"
                />
              </div>
              <div>
                <Label htmlFor="billingState">State</Label>
                <Select
                  value={formData.billingState || ''}
                  onValueChange={(value) => updateField('billingState', value)}
                >
                  <SelectTrigger id="billingState">
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
                <Label htmlFor="billingZipCode">Zip Code</Label>
                <Input
                  id="billingZipCode"
                  type="text"
                  value={formData.billingZipCode || ''}
                  onChange={(e) => updateField('billingZipCode', e.target.value)}
                  placeholder="Enter zip code"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onBack}>
            ← Back to Bank Account
          </Button>
          <Button onClick={handleNextClick} className="bg-teal-600 hover:bg-teal-700">
            Next: Compliance & Acknowledgements →
          </Button>
        </div>
      </div>
    </section>
  );
}
