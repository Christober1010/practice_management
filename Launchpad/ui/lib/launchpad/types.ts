export interface FormData {
  staffId?: number | null;
  // Personal Info
  formType: string;
  firstName: string;
  middleName: string;
  lastName: string;
  jobTitle: string;
  employmentStatus: string;
  ssn: string;
  dob: string;
  email: string;
  cellPhone: string;
  homeWorkPhone: string;
  fullAddress: string;
  
  // Emergency Contact
  emergencyName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  
  // Professional Data
  highestDegree: string;
  yearAwarded: string;
  major: string;
  licenseStatus: string;
  licenseExpDate: string;
  npiNumber: string;
  languages: string;
  specialtyAreas: string;
  certTypes: string[];
  certNumber: string;
  certExpDate: string;
  
  // Attachments (uploads)
  cprUpload: File | null;
  certificateUpload: File | null;
  hasExistingCpr?: boolean;
  hasExistingCertificate?: boolean;
  existingCprFilename?: string | null;
  existingCertificateFilename?: string | null;
  
  // Bank Info
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: string;
  payrollAuth: boolean;
  
  // Location Info
  // General Office Information
  taxIdProfessional: string;
  officePhoneNumber: string;
  officePhoneExt: string;
  timeZone: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationDescription: string;
  
  // Facility Service Location Information / Box 32
  facilityType: string;
  facilityNpiNumber: string;
  facilityName: string;
  facilityAddress: string;
  facilityAptUnit: string;
  facilityCountry: string;
  facilityCity: string;
  facilityState: string;
  facilityZipCode: string;
  
  // Billing Provider Information / Box 33
  taxonomyCode: string;
  billingNpiNumber: string;
  billingProviderName: string;
  billingAddress: string;
  billingAptUnit: string;
  billingCountry: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  
  // Compliance
  hipaaAck: boolean;
  abuseAck: boolean;
  digitalSignature: string;
  signatureDate: string;
}

export interface ApiResponse {
  success: boolean;
  title?: string;
  message?: string;
  error?: string;
  user?: any;
  token?: string;
}

export interface MedicationEntry {
  name: string;
  dosageAdminTime: string;
  startDate: string;
  indication: string;
}

export interface ClientPreferenceCategories {
  edible: string;
  tangible: string;
  social: string;
  activity: string;
}

export interface ChildConditions {
  allergies: boolean;
  vision: boolean;
  hearing: boolean;
  sleep: boolean;
  feeding: boolean;
  sensory: boolean;
  educational: boolean;
  other: boolean;
}

export interface ClientIntakeData {
  childLegalName: string;
  childDob: string;
  completedBy: string;
  childHomeAddress: string;
  homePhone: string;
  cellPhone: string;
  physicianNameLocation: string;
  neurologistNameLocation: string;
  familyComposition: string;
  therapyGoals: string;
  preferredSchedule: string;
  preferences: ClientPreferenceCategories;
  diagnosis: string;
  medicalConditions: string;
  specialDiet: string;
  medications: MedicationEntry[];
  conditions: ChildConditions;
  conditionDetails: string;
  schoolName: string;
  grade: string;
  teachers: string;
  classroomType: string;
  schoolAddress: string;
  schoolHours: string;
  transportation: string;
  supportiveTherapies: string;
  previousAbaTherapy: string;
  consentInformedTreatmentAccepted: boolean;
  consentReleaseInformationAccepted: boolean;
  consentAssignmentOfBenefitsAccepted: boolean;
  consentAdditionalFeesAccepted: boolean;
  consentTreatmentAuthorizationAccepted: boolean;
  caregiverGuidelinesAccepted: boolean;
  parentGuardianSignature: string;
  parentGuardianSignatureDate: string;
  providerSignature: string;
  providerSignatureDate: string;
  /** Base64 data URL PDF of the completed form (generated client-side before submit). */
  completedFormPdf?: string;
}

