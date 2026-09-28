import type { ClientIntakeData } from '@/lib/launchpad/types';
import {
  CLIENT_INTAKE_CONSENT_SECTIONS,
  type ClientIntakeConsentKey,
} from '@/lib/launchpad/client-intake-consent-content';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formVal(value: string | undefined): string {
  const text = (value ?? '').trim();
  return text === '' ? '&nbsp;' : escapeHtml(text).replace(/\n/g, '<br />');
}

function checkbox(label: string, checked: boolean): string {
  const box = checked ? '☑' : '☐';
  return `<span class="checkbox-item"><span class="box">${box}</span> ${escapeHtml(label)}</span>`;
}

function brandHeader(): string {
  return `<div class="brand">
    <div class="brand-name">Maha Behavioral Health Services</div>
    <div class="brand-tagline">Engage, Empower, Excel</div>
  </div>`;
}

function sectionHeader(title: string): string {
  return `${brandHeader()}<h2 class="section-title">${escapeHtml(title)}</h2>`;
}

const DOCUMENT_CSS = `
@page { margin: 0.55in; }
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.35; margin: 0; }
.page { width: 816px; min-height: 1056px; box-sizing: border-box; padding: 52px; page-break-after: always; background: #fff; }
.page:last-child { page-break-after: auto; }
.brand { text-align: center; margin-bottom: 10px; }
.brand-name { font-size: 14pt; font-weight: bold; }
.brand-tagline { font-size: 11pt; font-style: italic; margin-top: 2px; }
.doc-title { text-align: center; font-size: 13pt; font-weight: bold; margin: 8px 0 12px; }
.intro { font-size: 10.5pt; margin-bottom: 14px; text-align: justify; }
.section-title { font-size: 12pt; font-weight: bold; margin: 0 0 10px; border-bottom: 1px solid #333; padding-bottom: 4px; }
.q { margin: 0 0 10px; }
.q-num { font-weight: bold; }
.line { min-height: 18px; border-bottom: 1px solid #111; padding: 2px 0 1px; display: inline-block; }
.block { min-height: 48px; border-bottom: 1px solid #111; padding: 4px 0; margin-bottom: 8px; }
.pref-table, .med-table, .checkbox-table, .sig-table, .sick-table { width: 100%; border-collapse: collapse; }
.pref-table th, .pref-table td, .med-table th, .med-table td { border: 1px solid #333; padding: 6px; vertical-align: top; }
.pref-table th, .med-table th { font-weight: bold; background: #f5f5f5; }
.checkbox-table td { font-size: 10.5pt; padding: 3px 8px 3px 0; width: 33%; }
.sick-table td { font-size: 9.5pt; padding: 1px 10px 1px 0; width: 33%; }
.guidelines { font-size: 10pt; margin: 0; padding-left: 18px; }
.guidelines li { margin-bottom: 6px; }
.sig-table { margin-top: 14px; }
.sig-line { border-bottom: 1px solid #111; min-height: 52px; padding-bottom: 2px; }
.sig-caption { font-size: 10pt; margin-top: 4px; }
.signature-img { max-height: 48px; max-width: 280px; }
`;

function signatureImg(dataUrl: string): string {
  if (dataUrl && /^data:image\//.test(dataUrl)) {
    return `<img src="${escapeHtml(dataUrl)}" alt="Signature" class="signature-img" />`;
  }
  return '<span>&nbsp;</span>';
}

function consentAcceptanceLine(data: ClientIntakeData, key: ClientIntakeConsentKey): string {
  return data[key]
    ? '<span class="accepted">☑ I have read and agree</span>'
    : '<span class="declined">☐ Not accepted</span>';
}

function buildConsentPagesHtml(data: ClientIntakeData): string {
  const pageOne = CLIENT_INTAKE_CONSENT_SECTIONS.slice(0, 2);
  const pageTwo = CLIENT_INTAKE_CONSENT_SECTIONS.slice(2);

  let html = `<div class="page">${brandHeader()}<div class="doc-title">Consents &amp; Authorizations</div>
    <p class="child-line"><strong>Child:</strong> ${formVal(data.childLegalName)} &nbsp; <strong>DOB:</strong> ${formVal(data.childDob)}</p>`;
  for (const section of pageOne) {
    html += `<section class="consent-section"><h3 class="consent-title">${escapeHtml(section.title)}</h3>`
      + `<p class="consent-body">${escapeHtml(section.body)}</p>`
      + `<p class="consent-check">${consentAcceptanceLine(data, section.key)}</p></section>`;
  }
  html += '</div>';

  html += `<div class="page">${brandHeader()}<div class="doc-title">Consents &amp; Authorizations (continued)</div>`;
  for (const section of pageTwo) {
    html += `<section class="consent-section"><h3 class="consent-title">${escapeHtml(section.title)}</h3>`
      + `<p class="consent-body">${escapeHtml(section.body)}</p>`
      + `<p class="consent-check">${consentAcceptanceLine(data, section.key)}</p></section>`;
  }
  html += '</div>';
  return html;
}

export function buildClientIntakeFormHtml(data: ClientIntakeData, intakeId = 0): string {
  const { conditions, preferences, medications } = data;

  const medRows = medications
    .filter((med) => med.name || med.dosageAdminTime || med.startDate || med.indication)
    .map(
      (med) =>
        `<tr><td>${formVal(med.name)}</td><td>${formVal(med.dosageAdminTime)}</td><td>${formVal(med.startDate)}</td><td>${formVal(med.indication)}</td></tr>`
    )
    .join('');
  const medRowsHtml = medRows || '<tr><td colspan="4">None reported</td></tr>';

  let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><style>${DOCUMENT_CSS}</style></head><body>`;

  html += `<div class="page">${brandHeader()}<div class="doc-title">Client Intake Packet</div>
    <p class="intro">This questionnaire is to be completed by the child's parent or legal guardian so that Maha Behavioral Health Services (MBHS) may learn essential information about your child for use in treatment planning. Maha Behavioral Health Services will ensure that any information provided by you is kept confidential according to HIPAA guidelines. Please contact the behavior analyst if you have any questions when completing this form. Please use the back of the page if you need more space.</p>
    ${sectionHeader('Demographic/Biopsychosocial Information')}
    <p class="q"><span class="q-num">1.</span> Legal name of child: <span class="line" style="min-width:220px;">${formVal(data.childLegalName)}</span> &nbsp; Child's DOB: <span class="line" style="min-width:100px;">${formVal(data.childDob)}</span></p>
    <p class="q"><span class="q-num">2.</span> Name of Person Completing this form:</p><div class="line" style="display:block;">${formVal(data.completedBy)}</div>
    <p class="q"><span class="q-num">3.</span> Child's Home Address:</p><div class="block">${formVal(data.childHomeAddress)}</div>
    <p class="q"><span class="q-num">4.</span> Telephone Number: <span class="line" style="min-width:140px;">${formVal(data.homePhone)}</span> (home) <span class="line" style="min-width:140px;">${formVal(data.cellPhone)}</span> (cell)</p>
    <p class="q"><span class="q-num">5.</span> Child's physician's name/location:</p><div class="block">${formVal(data.physicianNameLocation)}</div>
    <p class="q"><span class="q-num">6.</span> Child's neurologist's name/location:</p><div class="block">${formVal(data.neurologistNameLocation)}</div>
    <p class="q"><span class="q-num">7.</span> Describe family composition (including siblings/ages, and others living in the home):</p><div class="block" style="min-height:72px;">${formVal(data.familyComposition)}</div>
  </div>`;

  html += `<div class="page">${sectionHeader('General Information')}
    <p class="q"><span class="q-num">8.</span> Please indicate your goals for therapy?</p><div class="block" style="min-height:72px;">${formVal(data.therapyGoals)}</div>
    <p class="q"><span class="q-num">9.</span> Please indicate your preferred days/times for therapy (weekdays/weekends). Note that behavior therapy is most effective when implemented continuously and frequently.</p><div class="block" style="min-height:56px;">${formVal(data.preferredSchedule)}</div>
    <p class="q"><span class="q-num">10.</span> Please indicate items that your child prefers (approaches and/or engages with consistently and independently) in each category below:</p>
    <table class="pref-table"><thead><tr><th>Edible (e.g., chips)</th><th>Tangible (e.g., balls)</th><th>Social (e.g., tickles)</th><th>Activity (e.g., swim)</th></tr></thead>
    <tbody><tr><td>${formVal(preferences.edible)}</td><td>${formVal(preferences.tangible)}</td><td>${formVal(preferences.social)}</td><td>${formVal(preferences.activity)}</td></tr></tbody></table>
  </div>`;

  html += `<div class="page">${sectionHeader('Medical History')}
    <p class="q"><span class="q-num">11.</span> Indicate child's diagnosis, including age at diagnosis.</p><div class="block">${formVal(data.diagnosis)}</div>
    <p class="q"><span class="q-num">12.</span> Indicate any medical conditions/serious illnesses (e.g., asthma, recurrent ear infections) experienced by your child.</p><div class="block">${formVal(data.medicalConditions)}</div>
    <p class="q"><span class="q-num">13.</span> Does your child require a special diet? If yes, please describe.</p><div class="block">${formVal(data.specialDiet)}</div>
    <p class="q"><span class="q-num">14.</span> Indicate any medications taken by your child, including dosage, time of administration (e.g., morning), start date, and indication (purpose of medication).</p>
    <table class="med-table"><thead><tr><th>Medication Name</th><th>Dosage/Admin Time</th><th>Start Date</th><th>Indication</th></tr></thead><tbody>${medRowsHtml}</tbody></table>
    <p class="q"><span class="q-num">15.</span> Check any applicable conditions experienced by your child, and provide descriptive information about the conditions below.</p>
    <table class="checkbox-table"><tr>
      <td>${checkbox('Allergies', conditions.allergies)}</td><td>${checkbox('Vision', conditions.vision)}</td><td>${checkbox('Hearing', conditions.hearing)}</td>
    </tr><tr>
      <td>${checkbox('Sleep', conditions.sleep)}</td><td>${checkbox('Feeding', conditions.feeding)}</td><td>${checkbox('Sensory', conditions.sensory)}</td>
    </tr><tr>
      <td>${checkbox('Educational', conditions.educational)}</td><td colspan="2">${checkbox('Other (e.g., processing disorder)', conditions.other)}</td>
    </tr></table>
    <div class="block" style="min-height:56px;">${formVal(data.conditionDetails)}</div>
  </div>`;

  html += `<div class="page">${sectionHeader('Educational Information')}
    <p class="q"><span class="q-num">16.</span> Please provide information about your child's current school:</p>
    <p class="q">a. School name: <span class="line" style="min-width:200px;">${formVal(data.schoolName)}</span> &nbsp; Grade: <span class="line" style="min-width:80px;">${formVal(data.grade)}</span></p>
    <p class="q">b. Child's teacher(s): <span class="line" style="min-width:280px;">${formVal(data.teachers)}</span></p>
    <p class="q">c. Type of classroom (e.g., self-contained): <span class="line" style="min-width:220px;">${formVal(data.classroomType)}</span></p>
    <p class="q">d. Address:</p><div class="block">${formVal(data.schoolAddress)}</div>
    <p class="q">e. School hours: <span class="line" style="min-width:200px;">${formVal(data.schoolHours)}</span></p>
    <p class="q">f. Transportation information (e.g., bus):</p><div class="block">${formVal(data.transportation)}</div>
    <p class="q">g. Please indicate if your child currently receives supportive therapies (e.g., Speech and Language, Occupational?). Please indicate arranged times.</p><div class="block" style="min-height:56px;">${formVal(data.supportiveTherapies)}</div>
    <p class="q"><span class="q-num">17.</span> Has your child received ABA therapy in the past? If yes, please indicate time period and outcomes.</p><div class="block" style="min-height:56px;">${formVal(data.previousAbaTherapy)}</div>
  </div>`;

  html += buildConsentPagesHtml(data);

  html += `<div class="page">${sectionHeader('Caregiver Guidelines')}
    <p class="intro">The following guidelines are suggested for caregivers during applied behavior therapy. Caregiver participation in therapy is a must, and required by funding sources.</p>
    <ol class="guidelines">
      <li>A parent or responsible adult (over 18 years of age) must be in the home when therapy is being provided.</li>
      <li>Caregivers are expected to participate in therapy sessions. Specifically, caregivers will be trained to implement their child's behavior program, and data on the accuracy of their implementation will be collected.</li>
      <li>The area being used for therapy must be clean, of comfortable temperature, and well lit. In some cases, the therapist may ask for distracting stimuli to be removed from the training environment. Caregivers should not smoke in the home when a therapist is present. In addition, pets should be removed from therapy area to the greatest extent possible.</li>
      <li>Therapy may be conducted at home, school, or other environment (i.e., community), and will be allocated to those locations in which the child has the most difficulty.</li>
      <li>The materials and reinforcers used for therapy should be reserved for therapy sessions unless otherwise stated by the therapist.</li>
      <li>The child should be dressed and fed prior to therapist arrival unless these skills are being addressed in the program.</li>
      <li>Caregivers should contact the therapist 24 hours prior to the appointment if they know they are going to cancel a session. If more than 20% of sessions are canceled in a 3-month period, your child may lose his/her therapy slot.</li>
      <li>Sickness. Please give the therapist as much notice as possible prior to the scheduled session if you know that your child is sick. Sickness includes, but not limited to the following:
        <table class="sick-table"><tr><td>Temperature above 100</td><td>Communicable Disease</td><td>Foot/Mouth Disease</td></tr>
        <tr><td>Vomit</td><td>Mumps</td><td>Chicken Pox</td></tr><tr><td>Measles</td><td>Diarrhea</td><td>Pin Worm</td></tr>
        <tr><td>Strep Throat</td><td>Lice</td><td>Rash</td></tr><tr><td colspan="3">Pink Eye</td></tr></table></li>
      <li>If the therapist arrives, and the child is not at home, the therapist will wait 15 minutes before leaving. This will be considered a no-show. More than two no-shows within a 2-month period may result in your child losing his therapy slot.</li>
      <li>A therapist cannot change appointment times without agreement with the family.</li>
      <li>The therapist will give the family as much notice as possible before canceling a session. The therapist will call the family if they are going to be arriving more than 5 min late.</li>
      <li>Please do not call the therapist before 8 am or after 8 pm.</li>
      <li>In case of an accident or unusual incident (e.g., Baker Act, runaway), the family should immediately notify the therapist, who will inform their Regional Director of the event.</li>
      <li>Parents and contractors should be respectful and courteous to each other. Open communication between parents and contractors is essential to the establishment of a successful program for the child.</li>
      <li>If there are any problems or concerns, please contact the Lead Analyst on the case immediately.</li>
    </ol>
  </div>`;

  html += `<div class="page">${brandHeader()}<div class="sig-block">
    <p class="q">I understand and agree to the caregiver guidelines: <strong>${data.caregiverGuidelinesAccepted ? 'Yes' : 'No'}</strong></p>
    <table class="sig-table"><tr>
      <td width="72%"><div class="sig-line">${signatureImg(data.parentGuardianSignature)}</div><div class="sig-caption">Signature of Parent / Guardian</div></td>
      <td width="28%"><div class="sig-line">${formVal(data.parentGuardianSignatureDate)}</div><div class="sig-caption">Date</div></td>
    </tr></table>
    <table class="sig-table"><tr>
      <td width="72%"><div class="sig-line">${signatureImg(data.providerSignature)}</div><div class="sig-caption">Signature of MBHS Behavior Analysis Provider</div></td>
      <td width="28%"><div class="sig-line">${formVal(data.providerSignatureDate)}</div><div class="sig-caption">Date</div></td>
    </tr></table>
    ${intakeId > 0 ? `<p style="font-size:9pt;color:#444;margin-top:8px;">Intake ID: ${intakeId}</p>` : ''}
  </div></div>`;

  html += '</body></html>';
  return html;
}

/** Body HTML only (for mounting inside a print container). */
export function buildClientIntakeFormBodyHtml(data: ClientIntakeData): string {
  const full = buildClientIntakeFormHtml(data);
  const match = full.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : full;
}
