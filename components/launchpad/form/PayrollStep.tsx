'use client';

import { useState } from 'react';
import { FormData } from '@/lib/launchpad/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileText } from 'lucide-react';

interface PayrollStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PayrollStep({ formData, updateField, onNext, onBack }: PayrollStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const missingBankName = !formData.bankName.trim();
  const missingAccountName = !formData.accountName.trim();
  const missingAccountNumber = !formData.accountNumber.trim();
  const missingRoutingNumber = !formData.routingNumber.trim();
  const missingAccountType = !formData.accountType;
  const missingPayrollAuth = !formData.payrollAuth;
  const hasErrors =
    missingBankName ||
    missingAccountName ||
    missingAccountNumber ||
    missingRoutingNumber ||
    missingAccountType ||
    missingPayrollAuth;

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
              <CreditCard className="h-5 w-5 text-teal-600" />
              Bank Information
              <Badge variant="destructive" className="ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r text-sm text-red-800">
              <strong>Note:</strong> Please complete all bank fields and agree to the authorization below.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input
                  id="bankName"
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  required
                  className={
                    showErrors && missingBankName
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.bankName
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingBankName && (
                  <p className="text-red-500 text-xs mt-1">Bank name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="accountName">Name on Account *</Label>
                <Input
                  id="accountName"
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => updateField('accountName', e.target.value)}
                  required
                  className={
                    showErrors && missingAccountName
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.accountName
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingAccountName && (
                  <p className="text-red-500 text-xs mt-1">Account name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                  id="accountNumber"
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => updateField('accountNumber', e.target.value)}
                  required
                  className={
                    showErrors && missingAccountNumber
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.accountNumber
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingAccountNumber && (
                  <p className="text-red-500 text-xs mt-1">Account number is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="routingNumber">Routing Number *</Label>
                <Input
                  id="routingNumber"
                  type="text"
                  value={formData.routingNumber}
                  onChange={(e) => updateField('routingNumber', e.target.value)}
                  required
                  className={
                    showErrors && missingRoutingNumber
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.routingNumber
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingRoutingNumber && (
                  <p className="text-red-500 text-xs mt-1">Routing number is required</p>
                )}
              </div>
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="accountType" className="text-sm font-medium text-slate-700 mb-2 block">Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => updateField('accountType', value)}
                >
                  <SelectTrigger id="accountType">
                    <SelectValue placeholder="Select account type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Checking">Checking</SelectItem>
                    <SelectItem value="Savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
                {showErrors && missingAccountType && (
                  <p className="text-red-500 text-xs mt-1">Account type is required</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Authorization Agreement
              <Badge variant="destructive" className="ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 p-4 border rounded-lg bg-slate-50">
              I hereby authorize Maha Behavioral Health Services to deposit my paycheck directly into the above mentioned account. This authority will remain in effect until I have given written notice that I am terminating this contract, or until Maha Behavioral Health Services has notified me that this deposit service has been discontinued. This authorization also covers any necessary adjustments if an incorrect deposit is made.
            </p>
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={formData.payrollAuth}
                  onCheckedChange={(checked) => updateField('payrollAuth', checked === true)}
                />
                <span className="text-sm font-medium text-slate-700">
                  I agree to the terms of the Authorization Agreement. *
                </span>
              </label>
              {showErrors && missingPayrollAuth && (
                <p className="text-red-500 text-xs mt-2">Authorization agreement is required</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onBack}>
            ← Back to Professional Data
          </Button>
          <Button onClick={handleNextClick} className="bg-teal-600 hover:bg-teal-700">
            Next: Location Info →
          </Button>
        </div>
      </div>
    </section>
  );
}

