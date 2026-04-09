'use client';

import { useState } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { isFieldInvalid } from '@/utils/launchpad/validation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface EmergencyContactStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function EmergencyContactStep({ formData, updateField, onNext, onBack }: EmergencyContactStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const missingName = !formData.emergencyName.trim();
  const missingRelationship = !formData.relationship.trim();
  const missingPrimary = !formData.primaryPhone.trim();
  const invalidPrimary = isFieldInvalid('primaryPhone', formData.primaryPhone);
  const hasErrors = missingName || missingRelationship || missingPrimary || invalidPrimary;

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
            <AlertTriangle className="h-5 w-5 text-teal-600" />
            Emergency Contact Information
            <Badge variant="destructive" className="ml-2">Required</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r text-sm text-orange-800">
            <strong>Requirement:</strong> Provide a primary emergency contact who is aware they are your designated contact.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyName">Contact Name *</Label>
              <Input
                id="emergencyName"
                type="text"
                value={formData.emergencyName}
                onChange={(e) => updateField('emergencyName', e.target.value)}
                required
                className={
                  showErrors && missingName
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.emergencyName
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingName && (
                <p className="text-red-500 text-xs mt-1">Contact name is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="relationship">Relationship *</Label>
              <Input
                id="relationship"
                type="text"
                value={formData.relationship}
                onChange={(e) => updateField('relationship', e.target.value)}
                placeholder="e.g. Spouse, Parent"
                required
                className={
                  showErrors && missingRelationship
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.relationship
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingRelationship && (
                <p className="text-red-500 text-xs mt-1">Relationship is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="primaryPhone">Primary Phone *</Label>
              <Input
                id="primaryPhone"
                type="tel"
                value={formData.primaryPhone}
                onChange={(e) => updateField('primaryPhone', e.target.value)}
                required
                className={
                  isFieldInvalid('primaryPhone', formData.primaryPhone) || (showErrors && missingPrimary)
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                    : !formData.primaryPhone
                    ? "border-teal-500"
                    : ""
                }
              />
              {showErrors && missingPrimary && (
                <p className="text-red-500 text-xs mt-1">Primary phone is required</p>
              )}
              {invalidPrimary && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid phone number</p>
              )}
            </div>
            <div>
              <Label htmlFor="secondaryPhone">Secondary Phone</Label>
              <Input
                id="secondaryPhone"
                type="tel"
                value={formData.secondaryPhone}
                onChange={(e) => updateField('secondaryPhone', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>
              ← Back to Personal
            </Button>
            <Button onClick={handleNextClick} className="bg-teal-600 hover:bg-teal-700">
              Next: Professional Data →
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

