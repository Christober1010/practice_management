'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, FileCheck, HeartPulse, Home, Plus, School, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
const SignaturePad = dynamic(() => import('@/components/launchpad/SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] items-center justify-center rounded-lg border-2 border-slate-300 bg-white">
      <p className="text-sm text-slate-500">Loading signature pad...</p>
    </div>
  ),
});
import { submitClientIntake } from '@/lib/launchpad/api';
import {
  allClientIntakeConsentsAccepted,
  CLIENT_INTAKE_CONSENT_SECTIONS,
} from '@/lib/launchpad/client-intake-consent-content';
import type { ClientIntakeConsentKey } from '@/lib/launchpad/client-intake-consent-content';
import { buildClientIntakeFormBodyHtml } from '@/lib/launchpad/client-intake-form-document';
import {
  blobToDataUrl,
  CLIENT_INTAKE_PRINT_STYLES,
  renderClientIntakePdfFromData,
} from '@/lib/launchpad/client-intake-pdf';
import type { ChildConditions, ClientIntakeData, MedicationEntry } from '@/lib/launchpad/types';

const emptyMedication: MedicationEntry = {
  name: '',
  dosageAdminTime: '',
  startDate: '',
  indication: '',
};

const emptyConditions: ChildConditions = {
  allergies: false,
  vision: false,
  hearing: false,
  sleep: false,
  feeding: false,
  sensory: false,
  educational: false,
  other: false,
};

const initialIntakeData: ClientIntakeData = {
  childLegalName: '',
  childDob: '',
  completedBy: '',
  childHomeAddress: '',
  homePhone: '',
  cellPhone: '',
  physicianNameLocation: '',
  neurologistNameLocation: '',
  familyComposition: '',
  therapyGoals: '',
  preferredSchedule: '',
  preferences: {
    edible: '',
    tangible: '',
    social: '',
    activity: '',
  },
  diagnosis: '',
  medicalConditions: '',
  specialDiet: '',
  medications: [{ ...emptyMedication }],
  conditions: { ...emptyConditions },
  conditionDetails: '',
  schoolName: '',
  grade: '',
  teachers: '',
  classroomType: '',
  schoolAddress: '',
  schoolHours: '',
  transportation: '',
  supportiveTherapies: '',
  previousAbaTherapy: '',
  consentInformedTreatmentAccepted: false,
  consentReleaseInformationAccepted: false,
  consentAssignmentOfBenefitsAccepted: false,
  consentAdditionalFeesAccepted: false,
  consentTreatmentAuthorizationAccepted: false,
  caregiverGuidelinesAccepted: false,
  parentGuardianSignature: '',
  parentGuardianSignatureDate: '',
  providerSignature: '',
  providerSignatureDate: '',
};

interface ClientIntakeViewProps {
  onSubmitted?: (result: { success: boolean; title?: string; message?: string }) => void;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

export default function ClientIntakeView({ onSubmitted }: ClientIntakeViewProps) {
  const [formData, setFormData] = useState<ClientIntakeData>(initialIntakeData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedConditionLabels = useMemo(() => {
    return Object.entries(formData.conditions)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
  }, [formData.conditions]);

  const updateField = <K extends keyof ClientIntakeData>(field: K, value: ClientIntakeData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePreference = (field: keyof ClientIntakeData['preferences'], value: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value },
    }));
  };

  const updateCondition = (field: keyof ChildConditions, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      conditions: { ...prev.conditions, [field]: value },
    }));
  };

  const updateMedication = (index: number, field: keyof MedicationEntry, value: string) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.map((med, i) => (i === index ? { ...med, [field]: value } : med)),
    }));
  };

  const addMedication = () => {
    setFormData((prev) => ({
      ...prev,
      medications: [...prev.medications, { ...emptyMedication }],
    }));
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medications:
        prev.medications.length === 1
          ? [{ ...emptyMedication }]
          : prev.medications.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (!formData.childLegalName.trim()) return 'Legal name of child is required.';
    if (!formData.childDob) return "Child's date of birth is required.";
    if (!formData.completedBy.trim()) return 'Name of the person completing this form is required.';
    if (!formData.childHomeAddress.trim()) return "Child's home address is required.";
    if (!formData.homePhone.trim() && !formData.cellPhone.trim()) return 'At least one telephone number is required.';
    if (!formData.therapyGoals.trim()) return 'Therapy goals are required.';
    if (!formData.diagnosis.trim()) return "Child's diagnosis is required.";
    if (!allClientIntakeConsentsAccepted(formData)) {
      return 'All consents and authorizations must be accepted before signing and submitting.';
    }
    if (!formData.caregiverGuidelinesAccepted) return 'Caregiver guidelines must be accepted.';
    if (!formData.parentGuardianSignature) return 'Parent/guardian signature is required.';
    if (!formData.parentGuardianSignatureDate) return 'Parent/guardian signature date is required.';
    if (formData.providerSignature && !formData.providerSignatureDate) {
      return 'Provider signature date is required when provider signature is captured.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      onSubmitted?.({ success: false, title: 'Client Intake Incomplete', message: validationError });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let completedFormPdf: string | undefined;
    try {
      const bodyHtml = buildClientIntakeFormBodyHtml(formData);
      const pdfBlob = await renderClientIntakePdfFromData(bodyHtml, CLIENT_INTAKE_PRINT_STYLES);
      if (pdfBlob) {
        completedFormPdf = await blobToDataUrl(pdfBlob);
      }
    } catch (pdfError) {
      console.warn('Client intake PDF generation failed; server will generate PDF if available.', pdfError);
    }

    const result = await submitClientIntake({
      ...formData,
      completedFormPdf,
    });
    setIsSubmitting(false);
    onSubmitted?.({
      success: !!result.success,
      title: result.title || (result.success ? 'Client Intake Submitted' : 'Submission Failed'),
      message: result.message,
    });

    if (result.success) {
      setFormData(initialIntakeData);
    } else {
      setError(result.message || 'Client intake submission failed.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
            <Users className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Client Intake Packet</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-800">Maha Behavioral Health Services</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Complete this questionnaire so MBHS can collect essential information for treatment planning.
              Information provided here should be handled according to HIPAA guidelines.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-teal-600" />
            Demographic / Biopsychosocial Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Legal name of child" required>
              <Input value={formData.childLegalName} onChange={(e) => updateField('childLegalName', e.target.value)} />
            </Field>
            <Field label="Child's DOB" required>
              <Input type="date" value={formData.childDob} onChange={(e) => updateField('childDob', e.target.value)} />
            </Field>
            <Field label="Name of person completing this form" required>
              <Input value={formData.completedBy} onChange={(e) => updateField('completedBy', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Telephone (home)">
                <Input value={formData.homePhone} onChange={(e) => updateField('homePhone', e.target.value)} />
              </Field>
              <Field label="Telephone (cell)">
                <Input value={formData.cellPhone} onChange={(e) => updateField('cellPhone', e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Child's home address" required>
            <Textarea rows={3} value={formData.childHomeAddress} onChange={(e) => updateField('childHomeAddress', e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Child's physician name/location">
              <Textarea value={formData.physicianNameLocation} onChange={(e) => updateField('physicianNameLocation', e.target.value)} />
            </Field>
            <Field label="Child's neurologist name/location">
              <Textarea value={formData.neurologistNameLocation} onChange={(e) => updateField('neurologistNameLocation', e.target.value)} />
            </Field>
          </div>
          <Field label="Family composition, including siblings/ages and others living in the home">
            <Textarea rows={4} value={formData.familyComposition} onChange={(e) => updateField('familyComposition', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal-600" />
            General Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Goals for therapy" required>
            <Textarea rows={4} value={formData.therapyGoals} onChange={(e) => updateField('therapyGoals', e.target.value)} />
          </Field>
          <Field label="Preferred days/times for therapy (weekdays/weekends)">
            <Textarea rows={3} value={formData.preferredSchedule} onChange={(e) => updateField('preferredSchedule', e.target.value)} />
          </Field>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Items your child prefers</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Edible (e.g., chips)">
                <Textarea value={formData.preferences.edible} onChange={(e) => updatePreference('edible', e.target.value)} />
              </Field>
              <Field label="Tangible (e.g., balls)">
                <Textarea value={formData.preferences.tangible} onChange={(e) => updatePreference('tangible', e.target.value)} />
              </Field>
              <Field label="Social (e.g., tickles)">
                <Textarea value={formData.preferences.social} onChange={(e) => updatePreference('social', e.target.value)} />
              </Field>
              <Field label="Activity (e.g., swim)">
                <Textarea value={formData.preferences.activity} onChange={(e) => updatePreference('activity', e.target.value)} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-teal-600" />
            Medical History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Diagnosis, including age at diagnosis" required>
            <Textarea rows={3} value={formData.diagnosis} onChange={(e) => updateField('diagnosis', e.target.value)} />
          </Field>
          <Field label="Medical conditions/serious illnesses">
            <Textarea rows={3} value={formData.medicalConditions} onChange={(e) => updateField('medicalConditions', e.target.value)} />
          </Field>
          <Field label="Special diet, if any">
            <Textarea rows={3} value={formData.specialDiet} onChange={(e) => updateField('specialDiet', e.target.value)} />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Medications</h3>
              <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                <Plus className="mr-2 h-4 w-4" />
                Add medication
              </Button>
            </div>
            <div className="space-y-3">
              {formData.medications.map((medication, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Input placeholder="Medication name" value={medication.name} onChange={(e) => updateMedication(index, 'name', e.target.value)} />
                    <Input placeholder="Dosage/admin time" value={medication.dosageAdminTime} onChange={(e) => updateMedication(index, 'dosageAdminTime', e.target.value)} />
                    <Input type="date" value={medication.startDate} onChange={(e) => updateMedication(index, 'startDate', e.target.value)} />
                    <div className="flex gap-2">
                      <Input placeholder="Indication" value={medication.indication} onChange={(e) => updateMedication(index, 'indication', e.target.value)} />
                      <Button type="button" variant="outline" size="icon" onClick={() => removeMedication(index)} aria-label="Remove medication">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Applicable conditions</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.keys(emptyConditions).map((condition) => (
                <label key={condition} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <Checkbox
                    checked={formData.conditions[condition as keyof ChildConditions]}
                    onCheckedChange={(checked) =>
                      updateCondition(condition as keyof ChildConditions, checked === true)
                    }
                  />
                  <span className="capitalize">{condition}</span>
                </label>
              ))}
            </div>
            <Field label={`Condition details${selectedConditionLabels.length ? ` (${selectedConditionLabels.join(', ')})` : ''}`}>
              <Textarea rows={4} value={formData.conditionDetails} onChange={(e) => updateField('conditionDetails', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-teal-600" />
            Educational Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="School name">
              <Input value={formData.schoolName} onChange={(e) => updateField('schoolName', e.target.value)} />
            </Field>
            <Field label="Grade">
              <Input value={formData.grade} onChange={(e) => updateField('grade', e.target.value)} />
            </Field>
            <Field label="Child's teacher(s)">
              <Input value={formData.teachers} onChange={(e) => updateField('teachers', e.target.value)} />
            </Field>
            <Field label="Type of classroom">
              <Input value={formData.classroomType} onChange={(e) => updateField('classroomType', e.target.value)} />
            </Field>
            <Field label="School hours">
              <Input value={formData.schoolHours} onChange={(e) => updateField('schoolHours', e.target.value)} />
            </Field>
          </div>
          <Field label="School address">
            <Textarea value={formData.schoolAddress} onChange={(e) => updateField('schoolAddress', e.target.value)} />
          </Field>
          <Field label="Transportation information">
            <Textarea value={formData.transportation} onChange={(e) => updateField('transportation', e.target.value)} />
          </Field>
          <Field label="Supportive therapies and arranged times">
            <Textarea rows={4} value={formData.supportiveTherapies} onChange={(e) => updateField('supportiveTherapies', e.target.value)} />
          </Field>
          <Field label="Previous ABA therapy, time period, and outcomes">
            <Textarea rows={4} value={formData.previousAbaTherapy} onChange={(e) => updateField('previousAbaTherapy', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-teal-600" />
            Consents &amp; Authorizations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Please read each section below and check the box to confirm your agreement before signing.
          </p>
          {CLIENT_INTAKE_CONSENT_SECTIONS.map((section) => (
            <label
              key={section.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
            >
              <Checkbox
                checked={formData[section.key as ClientIntakeConsentKey]}
                onCheckedChange={(checked) =>
                  updateField(section.key as ClientIntakeConsentKey, checked === true)
                }
                className="mt-1"
              />
              <span className="space-y-2 text-sm text-slate-700">
                <span className="block font-semibold text-slate-900">{section.title}</span>
                <span className="block leading-6">{section.body}</span>
                <span className="text-red-500">*</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Caregiver Guidelines & Signatures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-slate-800">Caregiver participation is required by funding sources.</p>
            <p className="mt-2">
              A responsible adult must be present during therapy, caregivers are expected to participate in sessions,
              the therapy area should be clean and appropriate, appointments require advance cancellation notice, and
              open communication with MBHS providers is expected.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <Checkbox
              checked={formData.caregiverGuidelinesAccepted}
              onCheckedChange={(checked) => updateField('caregiverGuidelinesAccepted', checked === true)}
            />
            <span className="text-sm text-slate-700">
              I understand and agree to the caregiver guidelines.
              <span className="text-red-500"> *</span>
            </span>
          </label>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Signature of parent/guardian" required>
                <SignaturePad
                  existingSignature={formData.parentGuardianSignature || null}
                  onSave={(value) => updateField('parentGuardianSignature', value)}
                  onClear={() => updateField('parentGuardianSignature', '')}
                  saveOnStrokeEnd
                  width={520}
                />
              </Field>
              <Field label="Parent/guardian signature date" required>
                <Input
                  type="date"
                  value={formData.parentGuardianSignatureDate}
                  onChange={(e) => updateField('parentGuardianSignatureDate', e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <Field label="Signature of MBHS Behavior Analysis Provider">
                <SignaturePad
                  existingSignature={formData.providerSignature || null}
                  onSave={(value) => updateField('providerSignature', value)}
                  onClear={() => updateField('providerSignature', '')}
                  saveOnStrokeEnd
                  width={520}
                />
              </Field>
              <Field label="Provider signature date">
                <Input type="date" value={formData.providerSignatureDate} onChange={(e) => updateField('providerSignatureDate', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFormData(initialIntakeData)} disabled={isSubmitting}>
              Reset
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? 'Submitting...' : 'Submit Client Intake'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
