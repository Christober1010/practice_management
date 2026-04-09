'use client';

import { useEffect, useState } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import FormStepper from '@/components/launchpad/FormStepper';
import PersonalInfoStep from '@/components/launchpad/form/PersonalInfoStep';
import EmergencyContactStep from '@/components/launchpad/form/EmergencyContactStep';
import ProfessionalDataStep from '@/components/launchpad/form/ProfessionalDataStep';
import PayrollStep from '@/components/launchpad/form/PayrollStep';
import LocationStep from '@/components/launchpad/form/LocationStep';
import ComplianceStep from '@/components/launchpad/form/ComplianceStep';

interface FormViewProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onSubmit: () => void;
  currentStep?: string;
  onStepChange?: (step: string) => void;
  isSubmitting?: boolean;
}

export default function FormView({ formData, updateField, onSubmit, currentStep, onStepChange, isSubmitting = false }: FormViewProps) {
  const [activeTab, setActiveTab] = useState(currentStep || 'personal');

  useEffect(() => {
    if (currentStep) {
      setActiveTab(currentStep);
    }
  }, [currentStep]);

  const tabOrder = ['personal', 'emergency', 'professional', 'payroll', 'location', 'compliance'];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onStepChange?.(tab);
  };

  const handleNextTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      setActiveTab(nextTab);
      onStepChange?.(nextTab);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      const prevTab = tabOrder[currentIndex - 1];
      setActiveTab(prevTab);
      onStepChange?.(prevTab);
    }
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <FormStepper
          formData={formData}
          currentStep={activeTab}
          onStepClick={handleTabChange}
        />

        <TabsContent value="personal" className="space-y-6 mt-6">
          <PersonalInfoStep
            formData={formData}
            updateField={updateField}
            onNext={handleNextTab}
          />
        </TabsContent>

        <TabsContent value="emergency" className="space-y-6 mt-6">
          <EmergencyContactStep
            formData={formData}
            updateField={updateField}
            onNext={handleNextTab}
            onBack={handlePreviousTab}
          />
        </TabsContent>

        <TabsContent value="professional" className="space-y-6 mt-6">
          <ProfessionalDataStep
            formData={formData}
            updateField={updateField}
            onNext={handleNextTab}
            onBack={handlePreviousTab}
          />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6 mt-6">
          <PayrollStep
            formData={formData}
            updateField={updateField}
            onNext={handleNextTab}
            onBack={handlePreviousTab}
          />
        </TabsContent>

        <TabsContent value="location" className="space-y-6 mt-6">
          <LocationStep
            formData={formData}
            updateField={updateField}
            onNext={handleNextTab}
            onBack={handlePreviousTab}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6 mt-6">
          <ComplianceStep
            formData={formData}
            updateField={updateField}
            onSubmit={onSubmit}
            onBack={handlePreviousTab}
            isSubmitting={isSubmitting}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

