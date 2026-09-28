'use client';

import { useState } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { formatSSN } from '@/utils/launchpad/formatSSN';
import { isFieldInvalid, isValidEmail, isValidPhone, isValidSSN } from '@/utils/launchpad/validation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';

interface PersonalInfoStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onNext: () => void;
}

export default function PersonalInfoStep({ formData, updateField, onNext }: PersonalInfoStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const handleSSNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSSN(e.target.value);
    updateField('ssn', formatted);
  };

  const missingFirstName = !formData.firstName.trim();
  const missingLastName = !formData.lastName.trim();
  const missingDob = !formData.dob;
  const missingEmail = !formData.email.trim();
  const missingCellPhone = !formData.cellPhone.trim();
  const missingAddress = !formData.fullAddress.trim();
  const invalidSsn = !!formData.ssn && !isValidSSN(formData.ssn);
  const invalidEmail = !!formData.email && !isValidEmail(formData.email);
  const invalidCellPhone = !!formData.cellPhone && !isValidPhone(formData.cellPhone);

  const hasErrors =
    missingFirstName ||
    missingLastName ||
    missingDob ||
    missingEmail ||
    missingCellPhone ||
    missingAddress ||
    invalidSsn ||
    invalidEmail ||
    invalidCellPhone;

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-teal-600" />
            Personal Information
            <Badge variant="destructive" className="ml-2">Required</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Jane"
                required
                className={
                  showErrors && missingFirstName
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.firstName
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingFirstName && (
                <p className="text-red-500 text-xs mt-1">First name is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                type="text"
                value={formData.middleName}
                onChange={(e) => updateField('middleName', e.target.value)}
                placeholder="A. (Optional)"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Doe"
                required
                className={
                  showErrors && missingLastName
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.lastName
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingLastName && (
                <p className="text-red-500 text-xs mt-1">Last name is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                type="text"
                value={formData.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                placeholder="e.g. Behavior Technician"
              />
            </div>
            <div>
              <Label htmlFor="employmentStatus">Status</Label>
              <Select
                value={formData.employmentStatus}
                onValueChange={(value) => updateField('employmentStatus', value)}
              >
                <SelectTrigger id="employmentStatus">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ssn">Social Security Number *</Label>
              <Input
                id="ssn"
                type="text"
                value={formData.ssn}
                onChange={handleSSNChange}
                maxLength={11}
                placeholder="XXX-XX-XXXX"
                required
                className={
                  isFieldInvalid('ssn', formData.ssn) || (showErrors && !formData.ssn)
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.ssn
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && !formData.ssn && (
                <p className="text-red-500 text-xs mt-1">SSN is required</p>
              )}
              {invalidSsn && (
                <p className="text-red-500 text-xs mt-1">SSN must have exactly 9 digits</p>
              )}
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => updateField('dob', e.target.value)}
                required
                className={
                  showErrors && missingDob
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.dob
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingDob && (
                <p className="text-red-500 text-xs mt-1">Date of birth is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="staff@example.com"
                required
                className={
                  isFieldInvalid('email', formData.email) || (showErrors && missingEmail)
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.email
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingEmail && (
                <p className="text-red-500 text-xs mt-1">Email is required</p>
              )}
              {invalidEmail && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
              )}
            </div>
            <div>
              <Label htmlFor="cellPhone">Cell Phone *</Label>
              <Input
                id="cellPhone"
                type="tel"
                value={formData.cellPhone}
                onChange={(e) => updateField('cellPhone', e.target.value)}
                required
                className={
                  isFieldInvalid('cellPhone', formData.cellPhone) || (showErrors && missingCellPhone)
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.cellPhone
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingCellPhone && (
                <p className="text-red-500 text-xs mt-1">Cell phone is required</p>
              )}
              {invalidCellPhone && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid phone number</p>
              )}
            </div>
            <div>
              <Label htmlFor="homeWorkPhone">Home/Work Phone</Label>
              <Input
                id="homeWorkPhone"
                type="tel"
                value={formData.homeWorkPhone}
                onChange={(e) => updateField('homeWorkPhone', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fullAddress">Full Address *</Label>
            <Textarea
              id="fullAddress"
              rows={2}
              value={formData.fullAddress}
              onChange={(e) => updateField('fullAddress', e.target.value)}
              placeholder="Street, City, State, Zip"
              required
              className={
                showErrors && missingAddress
                  ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                  : !formData.fullAddress
                  ? "border-teal-500"
                  : ""
              }
            />
            {showErrors && missingAddress && (
              <p className="text-red-500 text-xs mt-1">Full address is required</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleNextClick} className="bg-teal-600 hover:bg-teal-700">
              Next: Emergency Contact →
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

