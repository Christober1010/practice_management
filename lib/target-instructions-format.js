/** Encode SD + target instructions in one DB text field (no schema migration). */
export function formatTargetInstructions(sd, instructionBody) {
  const body = String(instructionBody || "").trim();
  const stimulus = String(sd || "").trim();
  if (!stimulus) return body;
  if (!body) return `SD: ${stimulus}`;
  return `SD: ${stimulus}\n\n${body}`;
}

/** Split stored instructions into SD and body (legacy rows without SD pass through). */
export function parseTargetInstructions(instructions) {
  const text = String(instructions || "").trim();
  if (!text.startsWith("SD:")) {
    return { sd: "", instructions: text };
  }
  const newline = text.indexOf("\n");
  const firstLine = newline === -1 ? text : text.slice(0, newline);
  const sd = firstLine.replace(/^SD:\s*/, "").trim();
  const rest = newline === -1 ? "" : text.slice(newline).trim();
  return { sd, instructions: rest };
}

export function normalizeTaskStepsForApi(tasks = []) {
  return [...tasks]
    .map((t, idx) => {
      const order = Number.parseInt(t.step_order ?? t.sequence, 10);
      return {
        id: t.id,
        name: String(t.name || "").trim(),
        step_order: Number.isFinite(order) && order > 0 ? order : idx + 1,
        sequence: Number.isFinite(order) && order > 0 ? order : idx + 1,
      };
    })
    .filter((t) => t.name)
    .sort((a, b) => a.step_order - b.step_order);
}
