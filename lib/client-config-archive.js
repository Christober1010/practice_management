import toast from "react-hot-toast";
import { mahaverseFetch } from "@/lib/mahaverse-api";

/** MySQL returns archived as 0/1 or "0"/"1". */
export function isRowArchived(row) {
  return row?.archived === true || row?.archived === 1 || row?.archived === "1";
}

const ID_KEY = { domain: "domainId", program: "programId", target: "activityId" };
const LABEL = { domain: "Domain", program: "Program", target: "Target" };

/**
 * Archive / unarchive a client-level domain, program, or target
 * (client-modules.php PUT archive path — same as Configure data master lists).
 * @returns {Promise<boolean>}
 */
export async function setClientConfigArchived({ clientId, kind, id, archived }) {
  const label = LABEL[kind];
  try {
    const res = await mahaverseFetch("/client-modules.php", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        [ID_KEY[kind]]: id,
        archived: archived ? 1 : 0,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      toast.success(archived ? `${label} archived` : `${label} restored`);
      return true;
    }
    toast.error(json.message || `Failed to ${archived ? "archive" : "restore"} ${label.toLowerCase()}`);
  } catch (err) {
    toast.error(`Failed to ${archived ? "archive" : "restore"} ${label.toLowerCase()}`);
  }
  return false;
}
