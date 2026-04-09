'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { FormData } from '@/lib/launchpad/types';

interface TimelineProps {
  formData: FormData;
  currentStep: string;
  onStepClick: (stepId: string) => void;
}

const steps = [
  {
    id: 'personal',
    number: '850',
    title: 'Personal Information',
    checkFn: (data: FormData) => {
      return !!(
        data.formType &&
        data.firstName?.trim() &&
        data.lastName?.trim() &&
        data.ssn?.replace(/\D/g, '').length === 9 &&
        data.dob &&
        data.email?.trim() &&
        data.cellPhone?.trim() &&
        data.fullAddress?.trim()
      );
    },
  },
  {
    id: 'emergency',
    number: '855',
    title: 'Emergency Contact',
    checkFn: (data: FormData) => {
      return !!(
        data.emergencyName?.trim() &&
        data.relationship?.trim() &&
        data.primaryPhone?.trim()
      );
    },
  },
  {
    id: 'professional',
    number: '856',
    title: 'Professional Data',
    checkFn: (data: FormData) => {
      const baseCheck = !!(
        data.highestDegree &&
        data.yearAwarded?.trim() &&
        data.major?.trim() &&
        data.licenseStatus &&
        data.npiNumber?.trim()
      );
      
      const licenseCheck = data.licenseStatus === 'Not Licensed' || 
        (data.licenseStatus && data.licenseExpDate);
      
      const langCheck = data.languages?.split(',').filter(l => l.trim()).length > 0;
      
      const certCheck = !(data.certTypes.length > 0 && !data.certTypes.includes('Not Certified')) ||
        (data.certNumber?.trim() && data.certExpDate);
      
      return baseCheck && licenseCheck && langCheck && certCheck;
    },
  },
  {
    id: 'payroll',
    number: '810',
    title: 'Bank Account Info',
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
    id: 'compliance',
    number: '820',
    title: 'Policies & Signatures',
    checkFn: (data: FormData) => {
      return !!(
        data.hipaaAck &&
        data.abuseAck &&
        data.digitalSignature?.trim() &&
        data.signatureDate
      );
    },
  },
];

export default function Timeline({ formData, currentStep, onStepClick }: TimelineProps) {
  const getStepStatus = (step: typeof steps[0]) => {
    const isCompleted = step.checkFn(formData);
    const isCurrent = currentStep === step.id;
    return { isCompleted, isCurrent };
  };

  const formatTimestamp = () => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${month} ${day}, ${year} ${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <div className="w-full py-6">
      <div className="flex items-start justify-between relative">
        {/* Connection line - show progress between steps */}
        <div className="absolute top-6 left-12 right-12 h-0.5 z-0 bg-slate-700">
          {steps.map((step, index) => {
            if (index === steps.length - 1) return null;
            const isCompleted = step.checkFn(formData);
            return (
              <div
                key={`line-${index}`}
                className={`absolute h-full transition-all duration-300 ${
                  isCompleted ? 'bg-teal-600' : 'bg-slate-700'
                }`}
                style={{
                  left: `${(index / (steps.length - 1)) * 100}%`,
                  width: `${(1 / (steps.length - 1)) * 100}%`,
                }}
              ></div>
            );
          })}
        </div>
        
        {steps.map((step, index) => {
          const { isCompleted, isCurrent } = getStepStatus(step);
          const isClickable = isCompleted || isCurrent || index === 0 || steps[index - 1]?.checkFn(formData);
          
          return (
            <div
              key={step.id}
              className={`flex-1 flex flex-col items-center relative z-10 ${
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
              onClick={() => isClickable && onStepClick(step.id)}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-teal-600 border-2 border-teal-600'
                    : isCurrent
                    ? 'bg-slate-700 border-2 border-teal-500'
                    : 'bg-slate-800 border-2 border-slate-600'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-white" />
                ) : (
                  <Circle className={`h-6 w-6 ${isCurrent ? 'text-teal-400' : 'text-slate-500'}`} />
                )}
              </div>
              
              {/* Content */}
              <div className="mt-4 text-center min-w-[140px]">
                {/* <div className="text-sm font-semibold text-slate-300 mb-1">{step.number}</div> */}
                <div className={`text-xs font-medium mb-1 ${
                  isCurrent ? 'text-teal-400' : isCompleted ? 'text-slate-300' : 'text-slate-400'
                }`}>
                  {step.title}
                </div>
                {isCompleted && (
                  <div className="text-xs text-slate-500 mt-1">{formatTimestamp()}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

