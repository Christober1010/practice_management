export const SOAP_NOTES_REQUIRED_MESSAGE =
  "Complete all required SOAP notes fields.";

export const SOAP_NOTES_LOCKED_MESSAGE =
  "SOAP notes are locked after Complete. Only an admin can edit them.";

export const SOAP_TEXT_FIELDS = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

export function soapNotesFieldErrors(notes) {
  const errors = {};
  const people = Array.isArray(notes?.peoplePresent)
    ? notes.peoplePresent.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (people.length === 0) {
    errors.peoplePresent = "Select at least one person present.";
  }
  for (const { key, label } of SOAP_TEXT_FIELDS) {
    if (!String(notes?.[key] ?? "").trim()) {
      errors[key] = `${label} is required.`;
    }
  }
  return errors;
}
