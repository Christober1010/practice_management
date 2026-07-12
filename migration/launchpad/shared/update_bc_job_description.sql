-- Update existing Behavior Consultant row with the corrected job description.
-- (INSERT IGNORE seeding does not overwrite existing rows, so run this once.)

UPDATE OfferLetterPositions
SET job_description_template = 'Behavior Consultants considered for employment by MAHA BEHAVIORAL HEALTH SERVICES will meet the following requirements:

• Must hold at minimum a bachelor\'s degree in behavior analysis, psychology, education, or a related field; master\'s degree strongly preferred.
• Must be eligible to sit for the Board Certified Behavior Analyst® (BCBA®) exam or have recently completed the required supervised fieldwork hours.
• Maintain active registration/certification status with the Behavior Analyst Certification Board (BACB®) throughout employment.
• Complete all required Medicaid Waiver training and documentation as applicable.

Job Responsibilities and Expectations:

• Assessment Assistance: Conduct functional behavior assessments (FBAs) and skills assessments (such as the VB-MAPP, AFLS, or Vineland) under the direct supervision of a credentialed BCBA.
• Program Development: Draft behavior intervention plans (BIPs) and skill acquisition programs based on assessment data for supervisor review and approval.
• Data System Management: Set up and maintain data collection systems (electronic or paper-based) to track client progress accurately.
• Direct Therapy Implementation: Provide high-quality, direct Applied Behavior Analysis (ABA) therapy to clients during scheduled sessions if needed.
• Progress Monitoring: Regularly review client data to evaluate the effectiveness of current interventions and suggest program modifications to the supervising BCBA.
• Crisis Intervention: Implement approved safety and crisis management protocols when challenging behaviors escalate.
• RBT Support & Mentorship: Provide peer modeling, guidance, and fidelity checks to Registered Behavior Technicians (RBTs) on behavior plans and data collection techniques.
• Caregiver Training: Assist in conducting parent/caregiver training sessions to teach strategies that promote behavior generalization at home.
• Interdisciplinary Collaboration: Coordinate with the supervising BCBA and multi-disciplinary team members (speech therapists, occupational therapists, teachers) to ensure consistency in client care.
• Clinical Documentation: Complete timely, professional, and accurate session notes, progress reports, and insurance authorization updates.
• Supervision Compliance: Proactively schedule, track, and document monthly supervised fieldwork hours in strict accordance with BACB requirements as applicable.
• Ethical & Regulatory Adherence: Maintain strict adherence to the BACB\'s Ethics Code for Behavior Analysts and HIPAA confidentiality guidelines.'
WHERE position_code = 'BC';
