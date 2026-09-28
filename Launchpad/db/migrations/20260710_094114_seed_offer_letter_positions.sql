-- Seed default offer letter positions for Maha Behavioral Health.
-- Re-runnable: uses INSERT IGNORE so existing rows are not overwritten.

INSERT IGNORE INTO OfferLetterPositions (position_code, position_name, offer_letter_template, job_description_template) VALUES

('RBT', 'Registered Behavior Technician',
'We are pleased to formally offer you the position of "{{position}}" on a part-time basis at "Maha Behavioral Health Services".

The starting compensation for this role is {{pay_rate}}, with payments processed on a biweekly basis. Please note that this offer is contingent upon the successful completion of a background check.

We believe your skills and experience will be a valuable asset to our team, and we look forward to your contributions.

Should you have any questions or require further clarification, please contact me at info@mahabehavioralhealth.com.

Thank you,
Harini Chandramouli, MS, BCBA (She/her)
Founder and Clinical Director
Maha Behavioral Health Services',

'Registered Behavior Technicians considered for employment by MAHA BEHAVIORAL HEALTH SERVICES will meet the following requirements:

• Must have a high school diploma at a minimum; bachelor\'s degree preferred with coursework in behavior analysis or a related field.
• Complete 40-hour Registered Behavior Technician training.
• Maintain recertification of RBT training annually.
• Complete all necessary Medicaid Waiver training and documents.

Job Responsibilities and Expectations:

• Receive training on Behavior Analysis Service Plans (BASPs) for each consumer on their caseload.
• Implement BASPs as written.
• Provide services to consumers based on hours set by the Behavior Analyst.
• Collect data on a daily basis and provide it to the Behavior Analyst on a weekly basis.
• Communicate regularly with the Behavior Analyst.
• Train caregivers to implement the BASPs.
• Implement the BASP in all relevant settings.
• Attend meetings regarding consumer\'s behavior services as necessary.'),

('BC', 'Behavior Consultant',
'On behalf of Maha Behavioral Health, I am absolutely thrilled to offer you the position of Behavior Consultant. We have been incredibly impressed by your background, your dedication to clinical excellence, and your upcoming readiness to sit for the Board Certified Behavior Analyst® (BCBA®) exam. We are confident that your skills will be a wonderful asset to our team and the families we serve.

Please find the details of your employment offer outlined below:

  • Position: Behavior Consultant
  • Company: Maha Behavioral Health
  • Compensation: {{pay_rate}}
  • Classification: [Insert Exempt/Non-Exempt or Full-Time/Part-Time status]
  • Start Date: [Insert Target Start Date]

Contingencies of Employment
This offer of employment is contingent upon the successful completion of a comprehensive background check, reference checks, and verification of your legal right to work in the United States.

BCBA Certification & Compensation Adjustment
We recognize that you are preparing to take your BCBA exam in the near future. Upon your successful passing of the BCBA exam and official verification of your certification with the Behavior Analyst Certification Board (BACB®), your position, responsibilities, and compensation will be adjusted. Specifically, your hourly rate will increase from {{pay_rate}} to the New BCBA Hourly Rate, effective on the first pay period following the submission of your official BCBA certification to Human Resources.

At-Will Employment
Please note that this offer letter is not a contract or guarantee of employment for a definitive period of time. Your employment with Maha Behavioral Health is "at-will," meaning that either you or the company may terminate the employment relationship at any time, with or without cause or advance notice.

To accept this offer, please sign and date this letter below and return it to info@mahabehavioralhealth.com.

If you have any questions regarding these terms, please don\'t hesitate to reach out. We are incredibly excited about the prospect of you joining Maha Behavioral Health and growing your clinical career with us!

Warmly,
Harini Chandramouli, MS, BCBA (She/her)
Founder and Clinical Director
Maha Behavioral Health',

'Behavior Consultants considered for employment by MAHA BEHAVIORAL HEALTH SERVICES will meet the following requirements:

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
• Ethical & Regulatory Adherence: Maintain strict adherence to the BACB\'s Ethics Code for Behavior Analysts and HIPAA confidentiality guidelines.');
