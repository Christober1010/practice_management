'use client';

import { useState, useEffect } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Shield, Award } from 'lucide-react';

interface ProfessionalDataStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const CERTIFICATION_OPTIONS = ['BCBA-L1', 'BCBA-L2', 'BCBA-L3', 'BCABA', 'BSA', 'RBT', 'BT', 'Not Certified'];

export default function ProfessionalDataStep({ formData, updateField, onNext, onBack }: ProfessionalDataStepProps) {
  const [showLicenseDate, setShowLicenseDate] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setShowLicenseDate(formData.licenseStatus === 'Licensed' || formData.licenseStatus === 'Provisional');
  }, [formData.licenseStatus]);

  const handleCertChange = (cert: string, checked: boolean) => {
    if (checked) {
      // If "Not Certified" is selected, clear all other certifications
      if (cert === 'Not Certified') {
        updateField('certTypes', ['Not Certified']);
        updateField('certNumber', '');
        updateField('certExpDate', '');
      } else {
        // If a real certification is selected, remove "Not Certified" if it exists
        const newCerts = formData.certTypes.filter((c) => c !== 'Not Certified');
        updateField('certTypes', [...newCerts, cert]);
      }
    } else {
      updateField('certTypes', formData.certTypes.filter((c) => c !== cert));
      if (cert === 'RBT') {
        updateField('certificateUpload', null);
      }
    }
  };

  // Check if there are any real certifications (excluding "Not Certified")
  // This matches the backend logic - backend ignores "Not Certified" when checking for real certs
  const hasRealCert = formData.certTypes.some((c) => c !== 'Not Certified' && c.trim() !== '');
  const isCertified = hasRealCert; // Show cert fields if any real cert is selected
  const hasRbt = formData.certTypes.includes('RBT');
  const missingMajor = !formData.major.trim();
  const missingLicenseDate = showLicenseDate && !formData.licenseExpDate;
  const missingCertNumber = isCertified && !formData.certNumber.trim();
  const missingCertExp = isCertified && !formData.certExpDate;
  const missingRbtUpload = hasRbt && !formData.certificateUpload && !formData.hasExistingCertificate;
  const hasErrors = missingMajor || missingLicenseDate || missingCertNumber || missingCertExp || missingRbtUpload;

  const handleNextClick = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onNext();
  };

  return (
    <section className="section-transition">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-teal-600" />
              Education
              <Badge variant="destructive" className="ml-2">Major Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="highestDegree">Highest Degree</Label>
                <Select
                  value={formData.highestDegree}
                  onValueChange={(value) => updateField('highestDegree', value)}
                >
                  <SelectTrigger id="highestDegree">
                    <SelectValue placeholder="Select Degree..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High School">High School</SelectItem>
                    <SelectItem value="Associate">Associate</SelectItem>
                    <SelectItem value="Bachelor">Bachelor</SelectItem>
                    <SelectItem value="Master">Master</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearAwarded">Year Awarded</Label>
                <Input
                  id="yearAwarded"
                  type="number"
                  value={formData.yearAwarded}
                  onChange={(e) => updateField('yearAwarded', e.target.value)}
                  placeholder="YYYY"
                />
              </div>
              <div>
                <Label htmlFor="major">Major *</Label>
                <Input
                  id="major"
                  type="text"
                  value={formData.major}
                  onChange={(e) => updateField('major', e.target.value)}
                  placeholder="e.g. Psychology"
                  required
                  className={
                    showErrors && missingMajor
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.major
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingMajor && (
                  <p className="text-red-500 text-xs mt-1">Major is required</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Licensing & Certifications
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-bold text-slate-700 mb-2 block">License Status</Label>
                  <Select
                    value={formData.licenseStatus}
                    onValueChange={(value) => {
                      updateField('licenseStatus', value);
                      if (value === 'Licensed' || value === 'Provisional') {
                        setShowLicenseDate(true);
                      } else {
                        setShowLicenseDate(false);
                        updateField('licenseExpDate', '');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select license status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not Licensed">Not Licensed</SelectItem>
                      <SelectItem value="Licensed">Licensed</SelectItem>
                      <SelectItem value="Provisional">Provisional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showLicenseDate && (
                  <div className="transition-opacity duration-300">
                    <Label className="text-xs font-semibold text-teal-600 uppercase mb-1 block">
                      License Expiration Date (Required if Licensed/Provisional) *
                    </Label>
                    <Input
                      type="date"
                      value={formData.licenseExpDate}
                      onChange={(e) => updateField('licenseExpDate', e.target.value)}
                      required
                      className={
                        showErrors && missingLicenseDate
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                          : !formData.licenseExpDate
                          ? "border-teal-500"
                          : ""
                      }
                    />
                    {showErrors && missingLicenseDate && (
                      <p className="text-red-500 text-xs mt-1">License expiration date is required</p>
                    )}
                  </div>
                )}
                <div>
                  <Label htmlFor="npiNumber" className="text-sm font-bold text-slate-700 mb-1 block">NPI #</Label>
                  <Input
                    id="npiNumber"
                    type="text"
                    value={formData.npiNumber}
                    onChange={(e) => updateField('npiNumber', e.target.value)}
                    placeholder="National Provider ID"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-bold text-slate-700 mb-3 block">Active Certifications</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {CERTIFICATION_OPTIONS.map((cert) => (
                    <label key={cert} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={formData.certTypes.includes(cert)}
                        onCheckedChange={(checked) => handleCertChange(cert, checked === true)}
                      />
                      <span className={cert === 'Not Certified' ? 'text-slate-400' : ''}>{cert}</span>
                    </label>
                  ))}
                </div>

                {isCertified && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-bold text-slate-700 mb-1 block">
                        Cert # (Required if Certified) *
                      </Label>
                      <Input
                        type="text"
                        value={formData.certNumber}
                        onChange={(e) => updateField('certNumber', e.target.value)}
                        className={
                          showErrors && missingCertNumber
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                            : !formData.certNumber
                            ? "border-teal-500"
                            : ""
                        }
                      />
                      {showErrors && missingCertNumber && (
                        <p className="text-red-500 text-xs mt-1">Certification number is required</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-bold text-slate-700 mb-1 block">
                        Exp. Date (Required if Certified) *
                      </Label>
                      <Input
                        type="date"
                        value={formData.certExpDate}
                        onChange={(e) => updateField('certExpDate', e.target.value)}
                        className={
                          showErrors && missingCertExp
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                            : !formData.certExpDate
                            ? "border-teal-500"
                            : ""
                        }
                      />
                      {showErrors && missingCertExp && (
                        <p className="text-red-500 text-xs mt-1">Certification expiration date is required</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="cprUpload" className="text-sm font-bold text-slate-700 mb-1 block">
                      CPR Upload
                    </Label>
                    <Input
                      id="cprUpload"
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => updateField('cprUpload', e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-slate-500 mt-1">Accepted: PDF or images.</p>
                    {formData.hasExistingCpr && !formData.cprUpload && (
                      <p className="text-xs text-slate-500 mt-1">
                        Existing CPR on file{formData.existingCprFilename ? ` (${formData.existingCprFilename})` : ''} will be kept.
                      </p>
                    )}
                  </div>

                  {hasRbt && (
                    <div>
                      <Label htmlFor="certificateUpload" className="text-sm font-bold text-slate-700 mb-1 block">
                        Certificate Upload (Required for RBT) *
                      </Label>
                      <Input
                        id="certificateUpload"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => updateField('certificateUpload', e.target.files?.[0] || null)}
                      className={
                        showErrors && missingRbtUpload
                          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                          : !formData.certificateUpload
                          ? "border-teal-500"
                          : ""
                      }
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">Required when RBT is selected.</p>
                      {formData.hasExistingCertificate && !formData.certificateUpload && (
                        <p className="text-xs text-slate-500 mt-1">
                          Existing certificate on file{formData.existingCertificateFilename ? ` (${formData.existingCertificateFilename})` : ''} will be kept.
                        </p>
                      )}
                    {showErrors && missingRbtUpload && (
                      <p className="text-red-500 text-xs mt-1">Certificate upload is required for RBT</p>
                    )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-600" />
              Skills & Specialties
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Languages</Label>
                {(() => {
                  const languageOptions = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi'];
                  const isCustomLanguage = formData.languages && !languageOptions.includes(formData.languages) && formData.languages !== 'Other';
                  const selectedValue = isCustomLanguage ? 'Other' : (formData.languages || '');
                  
                  return (
                    <>
                      <Select
                        value={selectedValue}
                        onValueChange={(value) => {
                          if (value === 'Other') {
                            updateField('languages', 'Other');
                          } else {
                            updateField('languages', value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a language..." />
                        </SelectTrigger>
                        <SelectContent>
                          {languageOptions.map((lang) => (
                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                          ))}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {(formData.languages === 'Other' || isCustomLanguage) && (
                        <div className="mt-3">
                          <Input
                            type="text"
                            value={isCustomLanguage ? formData.languages : ''}
                            onChange={(e) => updateField('languages', e.target.value)}
                            placeholder="Enter custom language..."
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <Label htmlFor="specialtyAreas" className="text-sm font-medium text-slate-700 mb-2 block">Specialty Areas</Label>
                <Textarea
                  id="specialtyAreas"
                  value={formData.specialtyAreas}
                  onChange={(e) => updateField('specialtyAreas', e.target.value)}
                  rows={3}
                  placeholder="List areas with 6+ months supervised experience..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onBack}>
            ← Back to Emergency
          </Button>
          <Button onClick={handleNextClick} className="bg-teal-600 hover:bg-teal-700">
            Next: Bank Account →
          </Button>
        </div>
      </div>
    </section>
  );
}
