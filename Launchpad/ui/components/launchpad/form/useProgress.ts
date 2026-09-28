import { useMemo } from 'react';
import { FormData } from '@/lib/launchpad/types';

export function useProgress(formData: FormData) {
  return useMemo(() => {
    const requiredFields: Array<{ check: () => boolean }> = [];

    // Personal Info
    requiredFields.push({ check: () => !!formData.firstName.trim() });
    requiredFields.push({ check: () => !!formData.lastName.trim() });
    requiredFields.push({ check: () => formData.ssn.replace(/\D/g, '').length === 9 });
    requiredFields.push({ check: () => !!formData.dob });
    requiredFields.push({ check: () => !!formData.email.trim() });
    requiredFields.push({ check: () => !!formData.cellPhone.trim() });
    requiredFields.push({ check: () => !!formData.fullAddress.trim() });

    // Emergency Contact (required)
    requiredFields.push({ check: () => !!formData.emergencyName.trim() });
    requiredFields.push({ check: () => !!formData.relationship.trim() });
    requiredFields.push({ check: () => !!formData.primaryPhone.trim() });

    // Professional Data - only Major is mandatory
    requiredFields.push({ check: () => !!formData.major.trim() });
    
    // If license is Licensed/Provisional, expiration date is required
    if (formData.licenseStatus === 'Licensed' || formData.licenseStatus === 'Provisional') {
      requiredFields.push({ check: () => !!formData.licenseExpDate });
    }
    
    // Certifications - conditional: if any real cert selected, require details
    if (formData.certTypes.length > 0 && !formData.certTypes.includes('Not Certified')) {
      requiredFields.push({ check: () => !!formData.certNumber.trim() });
      requiredFields.push({ check: () => !!formData.certExpDate });
    }

    // If user selects RBT, require certificate upload
    if (formData.certTypes.includes('RBT')) {
      requiredFields.push({
        check: () => !!formData.certificateUpload || !!formData.hasExistingCertificate,
      });
    }

    // Bank Info (required)
    requiredFields.push({ check: () => !!formData.bankName.trim() });
    requiredFields.push({ check: () => !!formData.accountName.trim() });
    requiredFields.push({ check: () => !!formData.accountNumber.trim() });
    requiredFields.push({ check: () => !!formData.routingNumber.trim() });
    requiredFields.push({ check: () => !!formData.accountType });
    requiredFields.push({ check: () => !!formData.payrollAuth });

    // Location Info (required)
    requiredFields.push({ check: () => !!formData.taxIdProfessional?.trim() });
    requiredFields.push({ check: () => !!formData.officePhoneNumber?.trim() });
    requiredFields.push({ check: () => !!formData.locationName?.trim() });
    requiredFields.push({ check: () => !!formData.facilityType });
    requiredFields.push({ check: () => !!formData.facilityNpiNumber?.trim() });
    requiredFields.push({ check: () => !!formData.facilityName?.trim() });
    requiredFields.push({ check: () => !!formData.facilityAddress?.trim() });
    requiredFields.push({ check: () => !!formData.facilityCountry });
    requiredFields.push({ check: () => !!formData.facilityCity?.trim() });
    requiredFields.push({ check: () => !!formData.facilityState });
    requiredFields.push({ check: () => !!formData.facilityZipCode?.trim() });
    requiredFields.push({ check: () => !!formData.taxonomyCode });

    // Compliance (4 fields)
    requiredFields.push({ check: () => formData.hipaaAck });
    requiredFields.push({ check: () => formData.abuseAck });
    // Check if signature is a valid base64 data URL (starts with "data:image")
    requiredFields.push({ check: () => !!formData.digitalSignature && formData.digitalSignature.startsWith('data:image') });
    requiredFields.push({ check: () => !!formData.signatureDate });

    const totalCount = requiredFields.length;
    const completedCount = requiredFields.filter((field) => field.check()).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return { percentage, completedCount, totalCount };
  }, [formData]);
}

