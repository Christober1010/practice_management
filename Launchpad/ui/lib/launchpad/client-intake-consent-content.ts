/** Consent section titles and body copy for client intake (pages 2–3 of consent packet). */

export const CLIENT_INTAKE_CONSENT_SECTIONS = [
  {
    key: 'consentInformedTreatmentAccepted',
    title: 'Informed Consent for Treatment',
    body: `I voluntarily consent to applied behavior analysis and related behavioral health services for my child from Maha Behavioral Health Services (MBHS). I understand the nature of the services proposed, including assessment, treatment planning, direct therapy, caregiver training, and data collection. MBHS staff have explained the anticipated benefits, risks, and alternatives. I understand I may ask questions at any time and may withdraw consent for future services by providing written notice, subject to any contractual or funding-source requirements.`,
  },
  {
    key: 'consentReleaseInformationAccepted',
    title: 'Authorization to Release Information',
    body: `I authorize MBHS to use and disclose protected health information (PHI) about my child as necessary to provide treatment, obtain payment, and conduct healthcare operations, including coordination with schools, physicians, funding sources, and other providers involved in my child's care. I authorize release of records to insurance companies and authorized payers for claims and utilization review. This authorization remains in effect until revoked in writing, except where law requires continued retention or disclosure.`,
  },
  {
    key: 'consentAssignmentOfBenefitsAccepted',
    title: 'Assignment of Benefits',
    body: `I assign payment of insurance and third-party benefits for services rendered by MBHS directly to Maha Behavioral Health Services. I authorize MBHS to submit claims on my behalf and to accept assignment of benefits from my insurer or other payers. I understand I am financially responsible for any amounts not covered by insurance, including deductibles, co-payments, co-insurance, and non-covered services, unless otherwise prohibited by law or my plan.`,
  },
  {
    key: 'consentAdditionalFeesAccepted',
    title: 'Authorization for Additional Fees',
    body: `I understand that services such as missed-appointment fees, late-cancellation fees, record-copy fees, travel fees when applicable, and other administrative or clinical fees not covered by insurance may apply according to MBHS policies and my funding source. I authorize MBHS to charge me for applicable fees as disclosed in the financial policy and caregiver guidelines. I agree to maintain current insurance and funding information and to notify MBHS promptly of changes.`,
  },
  {
    key: 'consentTreatmentAuthorizationAccepted',
    title: 'Authorization for Treatment',
    body: `I authorize MBHS providers to evaluate and treat my child, implement behavior-analytic and related interventions, and modify the treatment plan as clinically indicated with my participation. I agree to participate in caregiver training and to implement agreed-upon strategies between sessions when requested. I confirm that I am the parent or legal guardian authorized to consent to treatment for this child and that the information provided in this intake packet is accurate to the best of my knowledge.`,
  },
] as const;

export type ClientIntakeConsentKey = (typeof CLIENT_INTAKE_CONSENT_SECTIONS)[number]['key'];

export function allClientIntakeConsentsAccepted(
  data: Partial<Record<ClientIntakeConsentKey, boolean>>
): boolean {
  return CLIENT_INTAKE_CONSENT_SECTIONS.every((section) => data[section.key] === true);
}
