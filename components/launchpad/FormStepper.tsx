'use client';

import { useMemo } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { FormData } from '@/lib/launchpad/types';
import {
  Users,
  Phone,
  GraduationCap,
  CreditCard,
  MapPin,
  FileSignature,
} from 'lucide-react';

interface FormStepperProps {
  formData: FormData;
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

const steps = [
  {
    id: 'personal',
    label: 'Personal',
    icon: Users,
    checkFn: (data: FormData) => {
      // Match the exact validation logic from useProgress.ts
      const ssnDigits = (data.ssn || '').replace(/\D/g, '');
      return !!(
        data.firstName?.trim() &&
        data.lastName?.trim() &&
        ssnDigits.length === 9 &&
        data.dob &&
        data.email?.trim() &&
        data.cellPhone?.trim() &&
        data.fullAddress?.trim()
      );
    },
  },
  {
    id: 'emergency',
    label: 'Emergency',
    icon: Phone,
    checkFn: (data: FormData) => {
      return !!(data.emergencyName?.trim() && data.relationship?.trim() && data.primaryPhone?.trim());
    },
  },
  {
    id: 'professional',
    label: 'Professional',
    icon: GraduationCap,
    checkFn: (data: FormData) => {
      // Only Major is mandatory in this step.
      const majorOk = !!data.major?.trim();

      // If license is selected as Licensed/Provisional, require exp date.
      const licenseOk =
        data.licenseStatus !== 'Licensed' && data.licenseStatus !== 'Provisional'
          ? true
          : !!data.licenseExpDate;

      // If user selects any real certification (i.e., not Not Certified), require cert details.
      const isCertified = data.certTypes.length > 0 && !data.certTypes.includes('Not Certified');
      const certDetailsOk = !isCertified || (!!data.certNumber?.trim() && !!data.certExpDate);
      
      // If user selects RBT, require certificate upload.
      const hasRbt = data.certTypes.includes('RBT');
      const rbtUploadOk = !hasRbt || !!data.certificateUpload;

      return majorOk && licenseOk && certDetailsOk && rbtUploadOk;
    },
  },
  {
    id: 'payroll',
    label: 'Bank Account',
    icon: CreditCard,
    checkFn: (data: FormData) => {
      return !!(
        data.bankName?.trim() &&
        data.accountName?.trim() &&
        data.accountNumber?.trim() &&
        data.routingNumber?.trim() &&
        data.accountType &&
        data.payrollAuth
      );
    },
  },
  {
    id: 'location',
    label: 'Location',
    icon: MapPin,
    checkFn: (data: FormData) => {
      return !!(
        data.taxIdProfessional?.trim() &&
        data.officePhoneNumber?.trim() &&
        data.locationName?.trim() &&
        data.facilityType &&
        data.facilityNpiNumber?.trim() &&
        data.facilityName?.trim() &&
        data.facilityAddress?.trim() &&
        data.facilityCountry &&
        data.facilityCity?.trim() &&
        data.facilityState &&
        data.facilityZipCode?.trim() &&
        data.taxonomyCode
      );
    },
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: FileSignature,
    checkFn: (data: FormData) => {
      return !!(
        data.hipaaAck &&
        data.abuseAck &&
        data.digitalSignature &&
        data.digitalSignature.startsWith('data:image') &&
        data.signatureDate
      );
    },
  },
];

export default function FormStepper({ formData, currentStep, onStepClick }: FormStepperProps) {
  // Memoize completion status to ensure it recalculates when formData changes
  const completionStatus = useMemo(() => {
    return steps.map(step => step.checkFn(formData));
  }, [formData]);

  return (
    <div className="w-full py-4 bg-white border shadow rounded-lg border-slate-200">
      <div className="flex items-center justify-between relative max-w-5xl mx-auto px-4">
        {/* Connection lines container */}
        <div className="absolute top-6 left-0 right-0 h-0.5 flex z-0">
          {steps.map((step, index) => {
            if (index === steps.length - 1) return null;
            const isCompleted = completionStatus[index];
            return (
              <div
                key={`line-${index}`}
                className={`flex-1 h-full transition-all duration-300 ${
                  isCompleted ? 'bg-teal-600' : 'bg-slate-200'
                }`}
                style={{
                  marginLeft: index === 0 ? '48px' : '0',
                  marginRight: index === steps.length - 2 ? '48px' : '0',
                }}
              ></div>
            );
          })}
        </div>
        
        {steps.map((step, index) => {
          const isCompleted = completionStatus[index];
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;
          
          return (
            <div
              key={step.id}
              className="flex-1 flex flex-col items-center relative z-10 cursor-pointer"
              onClick={() => onStepClick(step.id)}
            >
              {/* Icon Circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2 ${
                  isCompleted
                    ? 'bg-teal-600 border-teal-600'
                    : isCurrent
                    ? 'bg-teal-50 border-teal-600'
                    : 'bg-white border-slate-300'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-white" />
                ) : (
                  <Icon className={`h-5 w-5 ${isCurrent ? 'text-teal-600' : 'text-slate-400'}`} />
                )}
              </div>
              
              {/* Label */}
              <div className="text-center">
                <div className={`text-xs font-medium ${
                  isCurrent ? 'text-teal-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

