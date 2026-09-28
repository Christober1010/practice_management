'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FormData } from '@/lib/launchpad/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, FileSignature } from 'lucide-react';

// Dynamically import SignaturePad with SSR disabled (uses canvas API)
const SignaturePad = dynamic(() => import('@/components/launchpad/SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="border-2 border-slate-300 rounded-lg bg-white" style={{ width: 600, height: 200 }}>
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading signature pad...</p>
      </div>
    </div>
  ),
});

interface ComplianceStepProps {
  formData: FormData;
  updateField: (field: keyof FormData, value: any) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export default function ComplianceStep({ formData, updateField, onSubmit, onBack, isSubmitting = false }: ComplianceStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const missingHipaa = !formData.hipaaAck;
  const missingAbuse = !formData.abuseAck;
  const missingSignature = !formData.digitalSignature || !formData.digitalSignature.startsWith('data:image');
  const missingSignatureDate = !formData.signatureDate;
  const hasErrors = missingHipaa || missingAbuse || missingSignature || missingSignatureDate;

  const handleSubmitClick = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onSubmit();
  };
  return (
    <section className="section-transition">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Confidentiality & HIPAA Agreement
              <Badge variant="destructive" className="ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="document-scroll text-slate-600">
              <h4 className="font-bold text-slate-800 mb-2">CONFIDENTIALITY & HIPAA AGREEMENT</h4>
              <p className="mb-2">
                The Health Insurance Portability and Accountability Act of 1996 (HIPAA) is federal legislation covering three areas: Insurance Portability, Fraud Enforcement, and Administrative Simplification. With the enactment of HIPAA, a client's right to have health information kept private became more than just an ethical obligation – it became the law. Punishment for HIPAA violations can result in large fines and possible jail time.
              </p>
              <p className="font-semibold mt-4 mb-2">Client Privacy Rules:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li>Client care and discussions are kept private by closing room doors.</li>
                <li>Confidential information is not left on an answering machine accessible to others.</li>
                <li>Client records are kept in a locked location, and only authorized personnel have access.</li>
                <li>Shred documents containing client information when purging records.</li>
              </ul>
              <p className="mt-4">
                <strong>Limits to Confidentiality:</strong> Confidentiality may be breached in certain situations, including: reporting communicable diseases, reporting certain medical device malfunctions to the FDA, reporting suspected child abuse or neglect (or abuse of developmentally disabled or elderly individuals) to the state protection agency at <strong>1-800-96 ABUSE (962-2873)</strong>, warning potential victims of homicidal intent, and when ordered by the court.
              </p>
              <p className="mt-4 font-semibold">CONFIDENTIALITY NOTICE (Email/Fax):</p>
              <p className="text-xs italic p-2 bg-slate-100 rounded">
                This email/fax message, including any attachments, is for the sole use of the intended recipient(s) and may contain confidential and privileged information. Any unauthorized review, use, disclosure, or distribution is prohibited. If you have received this email/fax message and are not the intended recipient, please contact the sender and destroy all copies of the original email/fax message.
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={formData.hipaaAck}
                  onCheckedChange={(checked) => updateField('hipaaAck', checked === true)}
                  required
                />
                <span className="text-sm font-medium text-slate-700">
                  I agree to all terms listed in the HIPAA outline.*
                </span>
              </label>
              {showErrors && missingHipaa && (
                <p className="text-red-500 text-xs mt-2">HIPAA acknowledgement is required</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-teal-600" />
              Child Abuse & Neglect Reporting
              <Badge variant="destructive" className="ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="document-scroll text-slate-600">
              <h4 className="font-bold text-slate-800 mb-2">Child Abuse & Neglect Reporting Requirements Acknowledgement</h4>
              <p className="mb-2">
                All child care personnel are mandated by law to report their suspicions of child abuse, neglect, or abandonment to the Florida Abuse Hotline in accordance with section 415.504(1)(e) of the Florida Statutes (F.S.).
              </p>
              <p className="mb-2">
                <strong>"Child Abuse or Neglect"</strong> is defined in s.415.503.(3).F.S., as "harm or threatened harm" to a child's mental or physical health or welfare by the acts or omissions of a parent, adult household member, or other person responsible for the child's welfare, or for purpose of reporting requirements by any person.
              </p>
              <p className="font-semibold mt-4 mb-2">Key Requirements:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li>Reports must be made immediately to the centralized Florida Abuse Hotline at <strong>1-800-96 ABUSE (962-2873)</strong>.</li>
                <li>All Reports are confidential. Mandated reporters are required to give their name.</li>
                <li>Any person acting in good faith is immune from liability.</li>
              </ul>
              <p className="mt-4">
                Categories of indicators include: <strong>Physical Abuse</strong> (unexplained bruise, burns), <strong>Physical Neglect</strong> (hunger, poor hygiene), and <strong>Sexual Abuse</strong> (withdrawal, excessive crying, physical symptoms).
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={formData.abuseAck}
                  onCheckedChange={(checked) => updateField('abuseAck', checked === true)}
                  required
                />
                <span className="text-sm font-medium text-slate-700">
                  I certify that I read the above material and understand my legal obligation to report.*
                </span>
              </label>
              {showErrors && missingAbuse && (
                <p className="text-red-500 text-xs mt-2">Abuse acknowledgement is required</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-teal-600" />
              Final Digital Signature
              <Badge variant="destructive" className="ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Please draw your signature below and select the date. By signing, you certify that all information provided is accurate and you acknowledge all policies above. <strong>Both signature and date are required for legal submission.</strong>
            </p>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Digital Signature *</Label>
                <SignaturePad
                  onSave={(dataURL) => {
                    updateField('digitalSignature', dataURL);
                  }}
                  onClear={() => {
                    updateField('digitalSignature', '');
                  }}
                  existingSignature={formData.digitalSignature || null}
                  width={600}
                  height={200}
                />
                {showErrors && missingSignature && (
                  <p className="text-xs text-red-500 mt-1">Please draw and save your signature</p>
                )}
              </div>
              <div>
                <Label htmlFor="signatureDate">Date *</Label>
                <Input
                  id="signatureDate"
                  type="date"
                  value={formData.signatureDate}
                  onChange={(e) => updateField('signatureDate', e.target.value)}
                  required
                  className={
                    showErrors && missingSignatureDate
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : !formData.signatureDate
                      ? "border-teal-500"
                      : ""
                  }
                />
                {showErrors && missingSignatureDate && (
                  <p className="text-red-500 text-xs mt-1">Signature date is required</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
            ← Back to Bank Info
          </Button>
          <Button onClick={handleSubmitClick} className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Submitting...
              </>
            ) : (
              'Complete Launchpad'
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

