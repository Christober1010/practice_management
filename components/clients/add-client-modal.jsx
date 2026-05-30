"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useState, useEffect, Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Phone,
  User,
  Shield,
  File,
  FileText,
  MapPin,
  Plus,
  Trash2,
  Heart,
  ChevronDown,
  ChevronRight,
  Pencil,
  Clock,
  Upload,
  X,
  Eye,
  Download,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import DocumentViewerModal from "./DocumentViewerModal";
import ClientConfigureDataPanel from "./client-configure-data-panel";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

const formatUSPhone = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const stripPhoneFormatting = (value) => (value || "").replace(/\D/g, "").slice(0, 10);

const popularCountries = [
  "USA",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Other",
];

// Authorization tab status should only be Active/Inactive.
// (Client workflow "Status" lives in Personal tab as `client_status`.)
const authorizationStatuses = ["Active", "Inactive"];

/** Values that match <SelectItem> in Personal → Status (workflow). */
const WORKFLOW_CLIENT_STATUS_OPTIONS = [
  "New",
  "Benefits Verification",
  "Prior Authorization",
  "Client Assessment",
  "Pending Authorization",
  "Initial Authorization",
  "Active Treatment",
  "Reauthorization",
];

const CLIENT_STATUS_ALIASES = {
  Reauth: "Reauthorization",
  "Re-auth": "Reauthorization",
  "Re Auth": "Reauthorization",
  "Active Tx": "Active Treatment",
  ActiveTreatment: "Active Treatment",
};

function normalizeClientStatusForForm(raw) {
  if (raw == null || String(raw).trim() === "") return "New";
  const trimmed = String(raw).trim();
  const aliased = CLIENT_STATUS_ALIASES[trimmed] || trimmed;
  if (WORKFLOW_CLIENT_STATUS_OPTIONS.includes(aliased)) return aliased;
  return trimmed;
}

const makeLocalId = (prefix) => {
  // Prefer UUID when available (modern browsers), otherwise fall back.
  if (typeof crypto !== "undefined" && crypto?.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const fallbackDocumentTypes = [
  "Insurance",
  "Intake Doc",
  "Clinical Doc",
  "Service Doc",
  "Misc",
];

const getDocumentDisplayName = (doc, index) => {
  if (!doc) return `Document #${index + 1}`;
  const byName =
    doc.document_file?.name ||
    doc.document_original_filename ||
    doc.document_filename;
  if (byName && String(byName).trim()) return String(byName).trim();

  const path = doc.document_path || doc.file_url || "";
  if (typeof path === "string" && path) {
    // Prefer basename for local/http paths
    if (path.startsWith("uploads/") || path.startsWith("http")) {
      const last = path.split("/").filter(Boolean).pop();
      if (last) return last;
    }
    // Drive URIs often don't contain a human name; keep a friendly fallback
    if (path.startsWith("drive://")) return "Drive Document";
  }

  return `Document #${index + 1}`;
};

const billingCodeOptions = [
  { code: "97151", name: "Behavior Identification Assessment" },
  { code: "97152", name: "Behavior Identification Supporting Assessment" },
  { code: "97153", name: "Adaptive Behavior Treatment by Protocol" },
  { code: "97154", name: "Group Adaptive Behavior Treatment by Protocol" },
  {
    code: "97155",
    name: "Adaptive Behavior Treatment with Protocol Modification",
  },
  { code: "97156", name: "Family Adaptive Behavior Treatment Guidance" },
  {
    code: "97157",
    name: "Multiple Family Group Adaptive Behavior Treatment Guidance",
  },
  {
    code: "97158",
    name: "Group Adaptive Behavior Treatment with Protocol Modification",
  },
];

const initialClientState = {
  // Personal
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  preferred_language: "",
  client_status: "New",
  is_active: true,
  wait_list_status: "No",
  location: "",

  // Contact
  phone: "",
  email: "",
  appointment_reminder: "",

  addresses: [
    {
      id: Date.now(),
      service_location: "Home",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
      country: "USA",
      countryOther: "",
    },
  ],

  // Guardian/Parent
  parent_first_name: "",
  parent_last_name: "",
  relationship_to_insured: "",
  relation_other: "",

  // Emergency Contact
  emergency_contact_name: "",
  emg_relationship: "",
  emg_phone: "",
  emg_email: "",

  // Insurance
  insurances: [],
  authorizations: [],
  primary_diagnosis: "",

  // Documents
  documents: [],

  // Notes
  client_notes: "",
  other_information: "",

  // Availability (flattened for form)
  mondayAvailable: false,
  mondayStart: "",
  mondayEnd: "",
  tuesdayAvailable: false,
  tuesdayStart: "",
  tuesdayEnd: "",
  wednesdayAvailable: false,
  wednesdayStart: "",
  wednesdayEnd: "",
  thursdayAvailable: false,
  thursdayStart: "",
  thursdayEnd: "",
  fridayAvailable: false,
  fridayStart: "",
  fridayEnd: "",
  saturdayAvailable: false,
  saturdayStart: "",
  saturdayEnd: "",
  sundayAvailable: false,
  sundayStart: "",
  sundayEnd: "",
};

// Helper to generate time options for dropdown (e.g., "08:00", "08:15", ..., "23:45")
const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, "0");
      const minute = m.toString().padStart(2, "0");
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

// Helper to format 24hr time to 12hr AM/PM for display in dropdown
const formatTimeForDropdown = (time24hr) => {
  if (!time24hr) return "";
  const [hours, minutes] = time24hr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${ampm}`;
};

export default function AddClientModal({
  isOpen,
  onClose,
  onSave,
  editingClient,
  filteredStaff,
  initialTab = null,
}) {
  const [formData, setFormData] = useState(initialClientState);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("personal");
  const [activeInsuranceTab, setActiveInsuranceTab] = useState("Primary");
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [diagnosisCodes, setDiagnosisCodes] = useState([]);
  const [providerServiceCodeMappings, setProviderServiceCodeMappings] = useState([]);
  const [allServiceCodes, setAllServiceCodes] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [expandedAuthKeys, setExpandedAuthKeys] = useState(new Set());
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const primaryTabs = ["personal", "contact", "insurance"];
  const moreTabs = [
    "configureData",
    "authorization",
    "guardian",
    "availability",
    "documents",
    "notes",
  ];
  const tabOrder = [
    "personal",
    "contact",
    "guardian",
    "insurance",
    "configureData",
    "authorization",
    "availability",
    "documents",
    "notes",
  ];

  useEffect(() => {
    if (!isOpen || !initialTab) return;
    const allowed = new Set([
      "personal",
      "contact",
      "guardian",
      "insurance",
      "configureData",
      "authorization",
      "availability",
      "documents",
      "notes",
    ]);
    if (allowed.has(initialTab)) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  // Fetch providers, diagnosis codes on mount
  useEffect(() => {
    if (!baseUrl) return;
    
    const loadProviders = async () => {
      try {
        const res = await mahaverseFetch('/providers.php');
        const data = await res.json();
        if (data?.success) {
          setProviders(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load providers:", err);
      }
    };
    
    const loadDiagnosisCodes = async () => {
      try {
        const res = await mahaverseFetch('/diagnosis-codes.php');
        const data = await res.json();
        if (data?.success) {
          setDiagnosisCodes(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load diagnosis codes:", err);
      }
    };
    
    const loadFacilityTypes = async () => {
      try {
        const res = await mahaverseFetch('/facility-types.php?showArchived=false&showInactive=false');
        const data = await res.json();
        if (data?.success) {
          setFacilityTypes(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load facility types:", err);
      }
    };

    const loadTreatmentTypes = async () => {
      try {
        const res = await mahaverseFetch('/treatment-types.php');
        const data = await res.json();
        if (data?.success) {
          setTreatmentTypes(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load treatment types:", err);
      }
    };

    const loadDocumentTypes = async () => {
      try {
        const res = await mahaverseFetch('/document-types.php');
        const data = await res.json();
        if (data?.success) {
          setDocumentTypes(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load document types:", err);
      }
    };

    loadProviders();
    loadDiagnosisCodes();
    loadFacilityTypes();
    loadTreatmentTypes();
    loadDocumentTypes();
  }, [baseUrl]);

  // Load provider service code mappings when insurance provider changes
  useEffect(() => {
    if (!baseUrl) return;
    
    const loadMappings = async () => {
      const providerIds = formData.insurances
        .map(ins => ins.insurance_provider_id)
        .filter(Boolean);
      
      if (providerIds.length === 0) {
        setProviderServiceCodeMappings([]);
        return;
      }
      
      try {
        // Load mappings for all selected providers
        const allMappings = [];
        for (const providerId of providerIds) {
          const res = await mahaverseFetch(`/provider-service-codes.php?provider_id=${providerId}`);
          const data = await res.json();
          if (data?.success && data.data) {
            allMappings.push(...data.data);
          }
        }
        setProviderServiceCodeMappings(allMappings);
      } catch (err) {
        console.error("Failed to load provider service code mappings:", err);
        setProviderServiceCodeMappings([]);
      }
    };
    
    loadMappings();
  }, [baseUrl, formData.insurances.map(ins => ins.insurance_provider_id).join(',')]);

  // Load all service codes as fallback when provider mappings are empty
  useEffect(() => {
    if (!baseUrl) return;
    const load = async () => {
      try {
        const res = await mahaverseFetch('/service-codes.php');
        const data = await res.json();
        if (data?.success && data.data) {
          setAllServiceCodes(data.data);
        }
      } catch {
        setAllServiceCodes([]);
      }
    };
    load();
  }, [baseUrl]);

  useEffect(() => {
  if (editingClient) {
    const addresses = editingClient.addresses?.length
      ? editingClient.addresses.map((addr) => ({
          ...addr,
          id: addr.id || Date.now(),
        }))
      : [
          {
            id: Date.now(),
            service_location: editingClient.service_location || "Home",
            address_line_1: editingClient.address_line_1 || "",
            address_line_2: editingClient.address_line_2 || "",
            city: editingClient.city || "",
            state: editingClient.state || "",
            zipcode: editingClient.zipcode || "",
            country: editingClient.country || "USA",
            countryOther: editingClient.countryOther || "",
          },
        ];

    const insurances = editingClient.insurances?.length
      ? editingClient.insurances.map((ins, index) => ({
          insurance_id: ins.insurance_id || `temp_${index}_${Date.now()}`,
          insurance_type: ins.insurance_type || "Primary",
          insurance_provider: ins.insurance_provider || "",
          insurance_provider_id: ins.insurance_provider_id || "",
          carrier_payer_id: ins.carrier_payer_id || "",
          insurance_issue_date: ins.insurance_issue_date?.slice(0, 10) || "",
          insurance_plan_name: ins.insurance_plan_name || "",
          date_of_signature: ins.date_of_signature?.slice(0, 10) || "",
          authorized_payment_box13: ins.authorized_payment_box13 || "Signature on File",
          authorized_release_box12: ins.authorized_release_box12 || "Signature on File",
          authorized_release_box17: ins.authorized_release_box17 || "Signature on File",
          additional_claim_info_box19: ins.additional_claim_info_box19 || "",
          do_not_accept_assignment_box27: ins.do_not_accept_assignment_box27 || false,
          insurance_notes: ins.insurance_notes || "",
          primary_insurance_notes: ins.primary_insurance_notes || "",
          insured_same_as_client: ins.insured_same_as_client !== undefined ? ins.insured_same_as_client : true,
          insurance_inactive: !!(ins.insurance_inactive === 1 || ins.insurance_inactive === "1" || ins.insurance_inactive === true),
          treatment_type: ins.treatment_type || "Behavioral therapy",
          provider_staff_id: ins.provider_staff_id || "",
          // `provider_name` comes from backend joins (read-only), `rendering_provider` is stored text.
          rendering_provider: ins.rendering_provider || ins.provider_name || "",
          start_date: ins.start_date?.slice(0, 10) || "",
          end_date: ins.end_date?.slice(0, 10) || "",
          authorization_number: ins.authorization_number || "",
          insurance_id_number: ins.insurance_id_number || "",
          group_number: ins.group_number || "",
          diagnosis_1: ins.diagnosis_1 || "",
          diagnosis_2: ins.diagnosis_2 || "",
          diagnosis_3: ins.diagnosis_3 || "",
          diagnosis_4: ins.diagnosis_4 || "",
          diagnosis_5: ins.diagnosis_5 || "",
          coinsurance: ins.coinsurance || "",
          deductible: ins.deductible || "",
          copay_per: ins.copay_per || "hr",
          copay_rate: ins.copay_rate || "",
          insured_first_name: ins.insured_first_name || "",
          insured_last_name: ins.insured_last_name || "",
          insured_dob: ins.insured_dob?.slice(0, 10) || "",
          insured_gender: ins.insured_gender || "",
          insured_relationship: ins.insured_relationship || "",
          insured_address: ins.insured_address || "",
          insured_city: ins.insured_city || "",
          insured_state: ins.insured_state || "",
          insured_zipcode: ins.insured_zipcode || "",
          insured_phone: ins.insured_phone || "",
          insured_id_number: ins.insured_id_number || "",
        }))
      : [];

    const authorizationsRaw = editingClient.authorizations?.length
      ? editingClient.authorizations.map((auth, index) => {
          const authInsuranceId = auth?.insurance_id;
          let insuranceIndex = -1;
          if (Array.isArray(editingClient.insurances)) {
            insuranceIndex = editingClient.insurances.findIndex(
              (ins) => String(ins?.insurance_id) === String(authInsuranceId)
            );
            if (insuranceIndex < 0) {
              const maybeIdx = Number.parseInt(String(authInsuranceId || ""), 10);
              if (
                Number.isFinite(maybeIdx) &&
                maybeIdx >= 0 &&
                maybeIdx < editingClient.insurances.length
              ) {
                insuranceIndex = maybeIdx;
              }
            }
          }
          const rawStatus = auth.status || "Active";
          const normalizedStatus =
            rawStatus === "Inactive"
              ? "Inactive"
              : rawStatus === "Expired" || rawStatus === "Denied"
              ? "Inactive"
              : "Active";
          return {
            auth_uuid: auth.auth_uuid || `auth_${Date.now()}_${index}`,
            insurance_id: insuranceIndex >= 0 ? String(insuranceIndex) : "",
            authorization_number: auth.authorization_number || "",
            billing_codes: auth.billing_codes || "",
            units_approved_per_15_min: auth.units_approved_per_15_min || "",
            units_serviced: auth.units_serviced || "",
            balance_units: auth.balance_units || "",
            ready_to_bill_sessions: Array.isArray(auth.ready_to_bill_sessions)
              ? auth.ready_to_bill_sessions
              : [],
            start_date: auth.start_date?.slice(0, 10) || "",
            end_date: auth.end_date?.slice(0, 10) || "",
            status: normalizedStatus,
          };
        })
      : [];

    // Assign auth_group_id for grouping: same group = same (insurance_id, authorization_number, start_date, end_date, status)
    const authGroupMap = new Map(); // composite -> groupId
    const authorizations = authorizationsRaw.map((auth) => {
      const key = `${auth.insurance_id}|${auth.authorization_number}|${auth.start_date}|${auth.end_date}|${auth.status}`;
      if (!authGroupMap.has(key)) {
        authGroupMap.set(key, auth.auth_uuid);
      }
      return {
        ...auth,
        auth_group_id: authGroupMap.get(key),
      };
    });

    // Normalize documents: ensure unique doc_uuid values (legacy rows sometimes have missing/duplicate ids).
    const seenDocUuids = new Set();
    const documentsNormalized =
      editingClient.documents?.map((doc, idx) => {
        const candidate =
          doc.doc_uuid || doc.document_uuid || doc.id || doc.doc_id || "";
        const docUuid =
          candidate && !seenDocUuids.has(candidate)
            ? candidate
            : makeLocalId("doc");
        seenDocUuids.add(docUuid);
        return {
          doc_uuid: docUuid,
          document_type: doc.document_type || "",
          document_path: doc.document_path || doc.file_url || "",
          document_filename: doc.document_filename || "",
          document_original_filename: doc.document_original_filename || "",
          document_file: null,
        };
      }) || [];

    setFormData({
      ...initialClientState,
      ...editingClient,
      addresses,
      insurances,
      authorizations,
      primary_diagnosis: editingClient.primary_diagnosis || "",
      is_active: editingClient.is_active !== undefined
        ? (editingClient.is_active === true || editingClient.is_active === 1 || editingClient.is_active === "1")
        : true,
      client_status: normalizeClientStatusForForm(
        editingClient.client_status ?? editingClient.STATUS,
      ),
      documents: documentsNormalized,
      date_of_birth: editingClient.date_of_birth?.slice(0, 10) || "",
      ...["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].reduce((acc, day) => {
        const avail = editingClient.availability?.[day];
        const slots = avail?.slots || (avail?.start ? [{ start: avail.start, end: avail.end }] : []);
        acc[`${day}Available`] = avail?.available || false;
        acc[`${day}Start`] = avail?.start || "";
        acc[`${day}End`] = avail?.end || "";
        acc[`${day}Slots`] = slots;
        return acc;
      }, {}),
    });
  } else {
    setFormData(initialClientState);
  }
  setErrors({});
  setExpandedAuthKeys(new Set());
  if (!editingClient) {
    setActiveTab("personal");
  } else if (!initialTab) {
    setActiveTab("personal");
  }
}, [editingClient, isOpen, initialTab]);

  const prepareDataForSave = () => {
    const firstAddress = formData.addresses[0] || {};

    const buildDayAvailability = (day) => {
      const slots = formData[`${day}Slots`] || (
        formData[`${day}Start`] ? [{ start: formData[`${day}Start`], end: formData[`${day}End`] }] : []
      );
      return {
        available: formData[`${day}Available`] || false,
        start: formData[`${day}Start`] || (slots[0]?.start || ""),
        end: formData[`${day}End`] || (slots[0]?.end || ""),
        slots: slots.filter(s => s.start && s.end),
      };
    };

    const availability = {
      monday: buildDayAvailability("monday"),
      tuesday: buildDayAvailability("tuesday"),
      wednesday: buildDayAvailability("wednesday"),
      thursday: buildDayAvailability("thursday"),
      friday: buildDayAvailability("friday"),
      saturday: buildDayAvailability("saturday"),
      sunday: buildDayAvailability("sunday"),
    };

    const cleanedData = {
      ...formData,
      address_line_1: firstAddress.address_line_1 || "",
      address_line_2: firstAddress.address_line_2 || "",
      city: firstAddress.city || "",
      state: firstAddress.state || "",
      zipcode: firstAddress.zipcode || "",
      country:
        firstAddress.country === "Other"
          ? firstAddress.countryOther
          : firstAddress.country || "USA",
      service_location: firstAddress.service_location || "Home",
      addresses: formData.addresses,
      insurances: formData.insurances
        .filter(
          (ins) =>
            ins.insurance_provider ||
            ins.insurance_id_number ||
            ins.treatment_type ||
            ins.provider_staff_id
        )
        .map((ins, index) => ({
          ...ins,
          insurance_index: index, // Add index to help backend map authorizations
        })),
      authorizations: (formData.authorizations || [])
        .filter(
          (auth) =>
            auth.authorization_number ||
            auth.billing_codes ||
            auth.units_approved_per_15_min
        )
        .map((auth, index) => {
          const approved =
            Number.parseFloat(auth.units_approved_per_15_min) || 0;
          const serviced = Number.parseFloat(auth.units_serviced) || 0;
          const { auth_group_id: _ag, ...rest } = auth;
          return {
            ...rest,
            insurance_index: auth.insurance_id,
            insurance_id: auth.insurance_id,
            status: auth.status || "Active",
            units_serviced: serviced.toString(),
            balance_units: (approved - serviced).toString(),
          };
        }),
      documents: formData.documents
        // Keep `document_file` so parent can upload on Save before JSON.stringify.
        // Parent (`components/clients/clients-view.jsx`) will strip file objects before POSTing JSON.
        .filter((doc) => doc.document_type || doc.document_path || doc.document_file)
        .map((doc) => doc),
      availability,
    };
    return cleanedData;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleAddressChange = (addressId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.map((addr) =>
        addr.id === addressId ? { ...addr, [field]: value } : addr
      ),
    }));
  };

  const addAddress = () => {
    const newAddress = {
      id: Date.now(),
      service_location: "Home",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
      country: "USA",
      countryOther: "",
    };
    setFormData((prev) => ({
      ...prev,
      addresses: [...prev.addresses, newAddress],
    }));
  };

  const removeAddress = (addressId) => {
    if (formData.addresses.length > 1) {
      setFormData((prev) => ({
        ...prev,
        addresses: prev.addresses.filter((addr) => addr.id !== addressId),
      }));
    }
  };

  const handleInsuranceChange = (insuranceId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.map((ins) =>
        ins.insurance_id === insuranceId ? { ...ins, [field]: value } : ins
      ),
    }));
    // Also clear errors
    const index = formData.insurances.findIndex(
      (ins) => ins.insurance_id === insuranceId
    );
    const errorKey = `insurance_${field}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }));
    }
  };

  // IMPORTANT: Do NOT upload on file select.
  // We only queue the file locally; the actual upload happens on "Save & Continue".
  const handleDocumentFileSelect = (docUuid, file) => {
    if (!file) return;

    // Validate file type and size
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    const maxSize = 25 * 1024 * 1024; // 25MB

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PDF, JPG, or PNG file.");
      return;
    }

    if (file.size > maxSize) {
      alert("File size must be less than 25MB.");
      return;
    }

    // Queue file for upload on Save
    handleDocumentChange(docUuid, "document_file", file);
    handleDocumentChange(docUuid, "document_original_filename", file.name);
    // Clear any previously stored path/id so Save re-uploads
    handleDocumentChange(docUuid, "document_path", "");
    handleDocumentChange(docUuid, "document_filename", "");
  };

  const handleRemoveDocumentFile = (docUuid) => {
    handleDocumentChange(docUuid, "document_path", "");
    handleDocumentChange(docUuid, "document_filename", "");
    handleDocumentChange(docUuid, "document_original_filename", "");
    handleDocumentChange(docUuid, "document_file", null);
  };

  const addInsurance = () => {
    const newInsurance = {
      insurance_id: `temp_${Date.now()}`, // Use a prefixed temporary ID
      insurance_type: "Primary",
      insurance_provider: "",
      insurance_provider_id: "",
      carrier_payer_id: "",
      insurance_issue_date: "",
      insurance_plan_name: "",
      date_of_signature: "",
      authorized_payment_box13: "Signature on File",
      authorized_release_box12: "Signature on File",
      authorized_release_box17: "Signature on File",
      additional_claim_info_box19: "",
      do_not_accept_assignment_box27: false,
      insurance_notes: "",
      primary_insurance_notes: "",
      insured_same_as_client: true,
      insurance_inactive: false,
      primary_diagnosis: "",
      treatment_type: "",
      provider_staff_id: "",
      start_date: "",
      end_date: "",
      insurance_id_number: "",
      group_number: "",
      coinsurance: "",
      deductible: "",
      copay_rate: "",
      insured_first_name: "",
      insured_last_name: "",
      insured_dob: "",
      insured_gender: "",
      insured_relationship: "",
      insured_address: "",
      insured_city: "",
      insured_state: "",
      insured_zipcode: "",
      insured_phone: "",
      insured_id_number: "",
    };
    setFormData((prev) => ({
      ...prev,
      insurances: [...prev.insurances, newInsurance],
    }));
  };

  const removeInsurance = (insuranceId) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.filter(
        (ins) => ins.insurance_id !== insuranceId
      ),
      authorizations:
        prev.authorizations?.filter(
          (auth) => auth.insurance_id !== insuranceId.toString()
        ) || [],
    }));
  };

  const handleAuthorizationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedAuthorizations = prev.authorizations.map((auth, i) => {
        if (i === index) {
          const updatedAuth = { ...auth, [field]: value };
          const approved =
            Number.parseFloat(
              field === "units_approved_per_15_min"
                ? value
                : updatedAuth.units_approved_per_15_min
            ) || 0;
          const serviced =
            Number.parseFloat(
              field === "units_serviced" ? value : updatedAuth.units_serviced
            ) || 0;
          updatedAuth.balance_units = (approved - serviced).toString();
          return updatedAuth;
        }
        return auth;
      });
      return { ...prev, authorizations: updatedAuthorizations };
    });
    const errorKey = `auth_${field}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }));
    }
  };

  const addNewAuthorization = (insuranceIndex) => {
    const groupId = makeLocalId("ag");
    const newAuth = {
      auth_uuid: makeLocalId("auth"),
      auth_group_id: groupId,
      insurance_id: String(insuranceIndex),
      authorization_number: "",
      billing_codes: "",
      units_approved_per_15_min: "",
      units_serviced: "",
      balance_units: "",
      start_date: "",
      end_date: "",
      status: "Active",
    };
    setFormData((prev) => ({
      ...prev,
      authorizations: [...(prev.authorizations || []), newAuth],
    }));
  };

  const addServiceCodeToAuth = (insuranceIndex, authGroupId) => {
    const groupRows = (formData.authorizations || []).filter(
      (a) => a.auth_group_id === authGroupId
    );
    const first = groupRows[0];
    if (!first) return;
    const newAuth = {
      auth_uuid: makeLocalId("auth"),
      auth_group_id: authGroupId,
      insurance_id: String(insuranceIndex),
      authorization_number: first.authorization_number || "",
      billing_codes: "",
      units_approved_per_15_min: "",
      units_serviced: "",
      balance_units: "",
      start_date: first.start_date || "",
      end_date: first.end_date || "",
      status: first.status || "Active",
    };
    setFormData((prev) => {
      const idx = prev.authorizations.findIndex((a) => a.auth_uuid === first.auth_uuid);
      const insertAt = idx + groupRows.length;
      const next = [...prev.authorizations];
      next.splice(insertAt, 0, newAuth);
      return { ...prev, authorizations: next };
    });
  };

  const handleAuthGroupFieldChange = (authGroupId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      authorizations: (prev.authorizations || []).map((auth) =>
        auth.auth_group_id === authGroupId ? { ...auth, [field]: value } : auth
      ),
    }));
  };

  const removeAuthGroup = (authGroupId) => {
    setFormData((prev) => ({
      ...prev,
      authorizations:
        prev.authorizations?.filter((auth) => auth.auth_group_id !== authGroupId) || [],
    }));
  };

  const removeAuthorization = (authUuid) => {
    setFormData((prev) => ({
      ...prev,
      authorizations:
        prev.authorizations?.filter((auth) => auth.auth_uuid !== authUuid) ||
        [],
    }));
  };

  const handleDocumentChange = (docUuid, field, value) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) =>
        doc.doc_uuid === docUuid ? { ...doc, [field]: value } : doc
      ),
    }));
    // Also clear errors
    const index = formData.documents.findIndex(
      (doc) => doc.doc_uuid === docUuid
    );
    const errorKey = `document_${field}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }));
    }
  };

  const addDocument = () => {
    const newDoc = {
      doc_uuid: makeLocalId("doc"),
      document_type: "",
      document_path: "",
      document_filename: "",
      document_original_filename: "",
      document_file: null,
    };
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));
  };

  const removeDocument = (docUuid) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc.doc_uuid !== docUuid),
    }));
  };

  const validateCurrentTab = (tab) => {
    const currentTabErrors = {};
    let hasErrors = false;

    const requiredEntry = (field) => {
      if (!field || !field.trim()) {
        hasErrors = true;
        return "Missing Required Entry";
      }
      return null;
    };

    switch (tab) {
      case "personal":
        currentTabErrors.first_name = requiredEntry(formData.first_name);
        currentTabErrors.last_name = requiredEntry(formData.last_name);
        currentTabErrors.date_of_birth = requiredEntry(formData.date_of_birth);
        currentTabErrors.client_status = requiredEntry(formData.client_status);
        break;

      case "contact":
        currentTabErrors.phone = requiredEntry(formData.phone);
        const emailError = requiredEntry(formData.email);
        if (emailError) {
          currentTabErrors.email = emailError;
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = "Invalid email format";
          hasErrors = true;
        }
        break;

      case "guardian":
        if (
          formData.parent_first_name?.trim() ||
          formData.parent_last_name?.trim()
        ) {
          currentTabErrors.parent_first_name = requiredEntry(
            formData.parent_first_name
          );
          currentTabErrors.parent_last_name = requiredEntry(
            formData.parent_last_name
          );
          currentTabErrors.relationship_to_insured = requiredEntry(
            formData.relationship_to_insured
          );
          if (formData.relationship_to_insured === "Other") {
            currentTabErrors.relation_other = requiredEntry(
              formData.relation_other
            );
          }
        }
        if (
          formData.emergency_contact_name?.trim() ||
          formData.emg_relationship?.trim() ||
          formData.emg_phone?.trim()
        ) {
          currentTabErrors.emergency_contact_name = requiredEntry(
            formData.emergency_contact_name
          );
          currentTabErrors.emg_relationship = requiredEntry(
            formData.emg_relationship
          );
          currentTabErrors.emg_phone = requiredEntry(formData.emg_phone);
        }
        break;

      case "insurance":
        formData.insurances.forEach((insurance, idx) => {
          if (
            insurance.insurance_provider?.trim() ||
            insurance.insurance_id_number?.trim() ||
            insurance.group_number?.trim()
          ) {
            currentTabErrors[`insurance_insurance_type_${idx}`] = requiredEntry(
              insurance.insurance_type
            );
            currentTabErrors[`insurance_insurance_provider_${idx}`] =
              requiredEntry(insurance.insurance_provider);
            currentTabErrors[`insurance_treatment_type_${idx}`] = requiredEntry(
              insurance.treatment_type
            );
            currentTabErrors[`insurance_insurance_id_number_${idx}`] =
              requiredEntry(insurance.insurance_id_number);
            currentTabErrors[`insurance_group_number_${idx}`] = requiredEntry(
              insurance.group_number
            );
            currentTabErrors[`insurance_start_date_${idx}`] = requiredEntry(
              insurance.start_date
            );
          }
        });

        formData.authorizations?.forEach((auth, idx) => {
          if (
            auth.authorization_number?.trim() ||
            auth.billing_codes?.trim() ||
            auth.units_approved_per_15_min?.trim()
          ) {
            const insIdx = auth.insurance_id;
            currentTabErrors[`auth_group_number_${insIdx}`] =
              requiredEntry(auth.authorization_number);
            currentTabErrors[`auth_group_start_${insIdx}`] = requiredEntry(
              auth.start_date
            );
            currentTabErrors[`auth_group_end_${insIdx}`] = requiredEntry(
              auth.end_date
            );
            currentTabErrors[`auth_group_status_${insIdx}`] = requiredEntry(
              auth.status
            );
            if (requiredEntry(auth.billing_codes)) {
              currentTabErrors[`auth_billing_${auth.auth_uuid}`] = "Billing code required";
              hasErrors = true;
            }
            if (requiredEntry(auth.units_approved_per_15_min)) {
              currentTabErrors[`auth_units_${auth.auth_uuid}`] = "Units approved required";
              hasErrors = true;
            }

            const approved =
              Number.parseFloat(auth.units_approved_per_15_min) || 0;
            const serviced = Number.parseFloat(auth.units_serviced) || 0;
            if (serviced > approved) {
              currentTabErrors[`auth_units_serviced_${auth.auth_uuid}`] =
                "Cannot exceed approved units";
              hasErrors = true;
            }
          }
        });
        break;

      case "documents":
        formData.documents.forEach((doc, idx) => {
          const hasAny =
            !!doc.document_type?.trim() ||
            !!doc.document_path?.trim() ||
            !!doc.document_filename?.trim() ||
            !!doc.document_file;
          if (hasAny) {
            currentTabErrors[`document_document_type_${idx}`] = requiredEntry(
              doc.document_type
            );
            const hasFile = !!doc.document_file || !!doc.document_path?.trim();
            if (!hasFile) {
              currentTabErrors[`document_file_${idx}`] = "Missing Required Entry";
              hasErrors = true;
            }
          }
        });
        break;

      case "availability":
        const days = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        days.forEach((day) => {
          if (formData[`${day}Available`]) {
            if (!formData[`${day}Start`].trim()) {
              currentTabErrors[`${day}Start`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (!formData[`${day}End`].trim()) {
              currentTabErrors[`${day}End`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (
              formData[`${day}Start`] &&
              formData[`${day}End`] &&
              formData[`${day}Start`] >= formData[`${day}End`]
            ) {
              currentTabErrors[`${day}End`] =
                "End time must be after start time";
              hasErrors = true;
            }
          }
        });
        break;

      default:
        break;
    }

    const finalErrors = Object.fromEntries(
      Object.entries(currentTabErrors).filter(([_, v]) => v != null)
    );
    setErrors((prev) => ({ ...prev, ...finalErrors }));

    return hasErrors;
  };

  const validateRequiredTabs = () => {
    let hasAnyErrors = false;
    let firstErrorTab = null;

    const requiredTabs = ["personal", "contact"];

    for (const tab of requiredTabs) {
      const hasTabErrors = validateCurrentTab(tab);
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab;
        hasAnyErrors = true;
      }
    }

    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }

    return hasAnyErrors;
  };

  const validateAllTabs = () => {
    let hasAnyErrors = false;
    let firstErrorTab = null;

    for (const tab of tabOrder) {
      const hasTabErrors = validateCurrentTab(tab);
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab;
        hasAnyErrors = true;
      }
    }

    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }
    return hasAnyErrors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({}); // Clear previous errors

    const hasErrors = validateRequiredTabs(); // Changed from validateAllTabs()
    if (hasErrors) {
      setSaving(false);
      return;
    }

    const dataToSave = prepareDataForSave();
    await onSave(dataToSave);
    setSaving(false);
  };

  const handleNextTab = (e) => {
    e.preventDefault();
    setErrors({});
    const hasErrors = validateCurrentTab(activeTab);
    if (hasErrors) {
      return;
    }

    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else {
      handleSave(e);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setFormData(initialClientState);
    setErrors({});
    setActiveTab("personal");
    onClose();
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value || ""}
        onChange={onChange}
        className={
          errors[id]
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : ""
        }
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    children,
    placeholder = "Select..."
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ""} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={
            errors[id]
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : ""
          }
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const addTimeSlot = (day) => {
    const slots = formData[`${day}Slots`] || [];
    handleInputChange(`${day}Slots`, [...slots, { start: "", end: "" }]);
  };

  const removeTimeSlot = (day, slotIdx) => {
    const slots = formData[`${day}Slots`] || [];
    const updated = slots.filter((_, i) => i !== slotIdx);
    handleInputChange(`${day}Slots`, updated);
    if (updated.length === 0) {
      handleInputChange(`${day}Available`, false);
      handleInputChange(`${day}Start`, "");
      handleInputChange(`${day}End`, "");
    }
  };

  const updateTimeSlot = (day, slotIdx, field, value) => {
    const slots = [...(formData[`${day}Slots`] || [])];
    slots[slotIdx] = { ...slots[slotIdx], [field]: value };
    handleInputChange(`${day}Slots`, slots);
    if (slotIdx === 0) {
      handleInputChange(`${day}Start`, slots[0].start);
      handleInputChange(`${day}End`, slots[0].end);
    }
  };

  const dayAbbrevs = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const getReferenceSlots = (excludingDay) => {
    for (const d of dayOrder) {
      if (d === excludingDay) continue;
      const avail = formData[`${d}Available`];
      const daySlots = formData[`${d}Slots`] || (formData[`${d}Start`] ? [{ start: formData[`${d}Start`], end: formData[`${d}End`] }] : []);
      if (avail && daySlots?.length > 0 && daySlots.some(s => s.start && s.end)) {
        return daySlots.filter(s => s.start && s.end).map(s => ({ start: s.start, end: s.end }));
      }
    }
    return [{ start: "08:00", end: "17:00" }];
  };

  const renderDayAvailability = (day, dayLabel) => {
    const isAvailable = formData[`${day}Available`];
    const slots = formData[`${day}Slots`] || (
      formData[`${day}Start`] ? [{ start: formData[`${day}Start`], end: formData[`${day}End`] }] : []
    );

    return (
      <div key={day} className={`rounded-lg border transition-colors ${isAvailable ? "border-teal-200 bg-teal-50/30" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id={`${day}Available`}
              checked={isAvailable}
              onCheckedChange={(checked) => {
                handleInputChange(`${day}Available`, checked);
                if (checked && slots.length === 0) {
                  const refSlots = getReferenceSlots(day);
                  handleInputChange(`${day}Slots`, refSlots);
                  handleInputChange(`${day}Start`, refSlots[0]?.start || "08:00");
                  handleInputChange(`${day}End`, refSlots[0]?.end || "17:00");
                }
              }}
            />
            <Label htmlFor={`${day}Available`} className="font-semibold text-sm cursor-pointer select-none">
              {dayLabel}
            </Label>
          </div>
          {isAvailable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-teal-600 hover:text-teal-700 h-7 text-xs"
              onClick={() => addTimeSlot(day)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Slot
            </Button>
          )}
        </div>
        {isAvailable && slots.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            {slots.map((slot, slotIdx) => (
              <div key={slotIdx} className="flex items-center gap-2 pl-8">
                <Select
                  value={slot.start || ""}
                  onValueChange={(v) => updateTimeSlot(day, slotIdx, "start", v)}
                >
                  <SelectTrigger className={`w-[120px] h-8 text-xs ${errors[`${day}Start`] && slotIdx === 0 ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Start">
                      {slot.start ? formatTimeForDropdown(slot.start) : "Start"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{formatTimeForDropdown(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-400 text-xs">to</span>
                <Select
                  value={slot.end || ""}
                  onValueChange={(v) => updateTimeSlot(day, slotIdx, "end", v)}
                >
                  <SelectTrigger className={`w-[120px] h-8 text-xs ${errors[`${day}End`] && slotIdx === 0 ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="End">
                      {slot.end ? formatTimeForDropdown(slot.end) : "End"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{formatTimeForDropdown(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {slot.start && slot.end && (
                  <Badge variant="secondary" className="text-xs h-6 whitespace-nowrap">
                    {(() => {
                      const [sh, sm] = slot.start.split(":").map(Number);
                      const [eh, em] = slot.end.split(":").map(Number);
                      const diff = (eh * 60 + em) - (sh * 60 + sm);
                      return diff > 0 ? `${(diff / 60).toFixed(1)}h` : "";
                    })()}
                  </Badge>
                )}
                {slots.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeTimeSlot(day, slotIdx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {errors[`${day}Start`] && (
              <p className="text-red-500 text-xs pl-8">{errors[`${day}Start`]}</p>
            )}
            {errors[`${day}End`] && (
              <p className="text-red-500 text-xs pl-8">{errors[`${day}End`]}</p>
            )}
          </div>
        )}
        {!isAvailable && (
          <div className="px-3 pb-2 pl-11">
            <span className="text-xs text-slate-400">Unavailable</span>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            {editingClient ? "Edit Client" : "Add New Client"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 w-full">
                <TabsList className="flex-1 grid grid-cols-3">
                  {primaryTabs.map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="flex items-center gap-2 data-[state=active]:bg-teal-100 data-[state=active]:text-teal-800 data-[state=active]:border data-[state=active]:border-teal-300 data-[state=active]:shadow-sm"
                    >
                      {tab === "personal" && (
                        <>
                          <Users className="h-4 w-4" /> Personal *
                        </>
                      )}
                      {tab === "contact" && (
                        <>
                          <Phone className="h-4 w-4" /> Contact *
                        </>
                      )}
                      {tab === "insurance" && (
                        <>
                          <Shield className="h-4 w-4" /> Insurance
                        </>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={moreTabs.includes(activeTab) ? "secondary" : "outline"}
                      size="sm"
                      className={`flex items-center gap-2 shrink-0 ${moreTabs.includes(activeTab) ? "bg-teal-100 text-teal-800 border-teal-300" : ""}`}
                    >
                      {moreTabs.includes(activeTab) ? (
                        <>
                          {activeTab === "configureData" && <SlidersHorizontal className="h-4 w-4" />}
                          {activeTab === "authorization" && <FileText className="h-4 w-4" />}
                          {activeTab === "guardian" && <User className="h-4 w-4" />}
                          {activeTab === "availability" && <Clock className="h-4 w-4" />}
                          {activeTab === "documents" && <File className="h-4 w-4" />}
                          {activeTab === "notes" && <FileText className="h-4 w-4" />}
                          {activeTab === "configureData" && "Configure data"}
                          {activeTab === "authorization" && "Authorization"}
                          {activeTab === "guardian" && "Guardian"}
                          {activeTab === "availability" && "Availability"}
                          {activeTab === "documents" && "Documents"}
                          {activeTab === "notes" && "Notes"}
                          <ChevronDown className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          More Options
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48" align="end">
                    {moreTabs.map((tab) => (
                      <DropdownMenuItem
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={activeTab === tab ? "bg-teal-50 font-medium" : ""}
                      >
                        {tab === "configureData" && (
                          <>
                            <SlidersHorizontal className="h-4 w-4 mr-2" /> Configure data
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                        {tab === "authorization" && (
                          <>
                            <FileText className="h-4 w-4 mr-2" /> Authorization
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                        {tab === "guardian" && (
                          <>
                            <User className="h-4 w-4 mr-2" /> Guardian
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                        {tab === "availability" && (
                          <>
                            <Clock className="h-4 w-4 mr-2" /> Availability
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                        {tab === "documents" && (
                          <>
                            <File className="h-4 w-4 mr-2" /> Documents
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                        {tab === "notes" && (
                          <>
                            <FileText className="h-4 w-4 mr-2" /> Notes
                            {activeTab === tab && <span className="ml-auto">✓</span>}
                          </>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal
                    Information
                    <Badge variant="destructive" className="ml-2">
                      Required
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderInputWithError(
                      "first_name",
                      "First Name *",
                      formData.first_name,
                      (e) => handleInputChange("first_name", e.target.value),
                      { placeholder: "Enter first name" }
                    )}
                    {renderInputWithError(
                      "middle_name",
                      "Middle Name",
                      formData.middle_name,
                      (e) => handleInputChange("middle_name", e.target.value),
                      { placeholder: "Enter middle name" }
                    )}
                    {renderInputWithError(
                      "last_name",
                      "Last Name *",
                      formData.last_name,
                      (e) => handleInputChange("last_name", e.target.value),
                      { placeholder: "Enter last name" }
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {renderInputWithError(
                      "date_of_birth",
                      "Date of Birth *",
                      formData.date_of_birth,
                      (e) => handleInputChange("date_of_birth", e.target.value),
                      { type: "date" }
                    )}
                    {renderSelectWithError(
                      "gender",
                      "Gender",
                      formData.gender,
                      (value) => handleInputChange("gender", value),
                      <>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Prefer not to say">
                          Prefer not to say
                        </SelectItem>
                      </>,
                      "Select gender"
                    )}
                    {renderInputWithError(
                      "preferred_language",
                      "Preferred Language",
                      formData.preferred_language,
                      (e) =>
                        handleInputChange("preferred_language", e.target.value),
                      { placeholder: "e.g., English, Spanish" }
                    )}
                    {renderSelectWithError(
                      "client_status",
                      "Status *",
                      formData.client_status,
                      (value) => handleInputChange("client_status", value),
                      <>
                        {formData.client_status &&
                          !WORKFLOW_CLIENT_STATUS_OPTIONS.includes(
                            formData.client_status,
                          ) && (
                            <SelectItem value={formData.client_status}>
                              {formData.client_status} (from database)
                            </SelectItem>
                          )}
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Benefits Verification">
                          Benefits Verification
                        </SelectItem>
                        <SelectItem value="Prior Authorization">
                          Prior Authorization
                        </SelectItem>
                        <SelectItem value="Client Assessment">
                          Client Assessment
                        </SelectItem>
                        <SelectItem value="Pending Authorization">
                          Pending Authorization
                        </SelectItem>
                        <SelectItem value="Initial Authorization">
                          Initial Authorization
                        </SelectItem>
                        <SelectItem value="Active Treatment">
                          Active Treatment
                        </SelectItem>
                        <SelectItem value="Reauthorization">
                          Reauthorization
                        </SelectItem>
                      </>,
                      "Select status"
                    )}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => handleInputChange("is_active", checked === true)}
                      />
                      <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                        Client is Active
                      </Label>
                    </div>
                  </div>
                  <div>
                    {renderSelectWithError(
                      "wait_list_status",
                      "Wait List Status",
                      formData.wait_list_status,
                      (value) => handleInputChange("wait_list_status", value),
                      <>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </>,
                      "Select wait list status"
                    )}
                  </div>
                  <div>
                    {renderInputWithError(
                      "location",
                      "Location",
                      formData.location,
                      (e) => handleInputChange("location", e.target.value),
                      { placeholder: "Enter your location" }
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-teal-600" /> Contact
                    Information
                    <Badge variant="destructive" className="ml-2">
                      Required
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "phone",
                      "Phone Number *",
                      formatUSPhone(formData.phone),
                      (e) => handleInputChange("phone", stripPhoneFormatting(e.target.value)),
                      { placeholder: "(123)-456-7890", maxLength: 14 }
                    )}
                    {renderInputWithError(
                      "email",
                      "Email Address *",
                      formData.email,
                      (e) => handleInputChange("email", e.target.value),
                      { type: "email", placeholder: "Enter email address" }
                    )}
                  </div>
                  <div>
                    {renderSelectWithError(
                      "appointment_reminder",
                      "Appointment Reminder Preference",
                      formData.appointment_reminder,
                      (value) =>
                        handleInputChange("appointment_reminder", value),
                      <>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="none">No Reminders</SelectItem>
                      </>,
                      "Select reminder preference"
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-teal-600" /> Address
                      Information
                      <Badge variant="secondary" className="ml-2">
                        Optional
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAddress}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Address
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.addresses.map((address, index) => (
                    <div
                      key={address.id}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Address #{index + 1}</h4>
                        {formData.addresses.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAddress(address.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {renderSelectWithError(
                        `service_location_${address.id}`,
                        "Service Location (Facility Type)",
                        address.service_location,
                        (value) =>
                          handleAddressChange(
                            address.id,
                            "service_location",
                            value
                          ),
                        <>
                          {facilityTypes.length > 0 ? (
                            facilityTypes
                              .filter((ft) => ft.active === 1)
                              .map((ft) => (
                                <SelectItem key={ft.id} value={ft.facility_name}>
                                  {ft.pos_code} - {ft.facility_name}
                                </SelectItem>
                              ))
                          ) : (
                            <>
                              <SelectItem value="Home">Home</SelectItem>
                              <SelectItem value="Telehealth">Telehealth</SelectItem>
                              <SelectItem value="Office">Office</SelectItem>
                              <SelectItem value="School">School</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </>
                          )}
                        </>,
                        "Select facility type"
                      )}
                      <div>
                        <Label htmlFor={`address_line_1_${address.id}`}>Address Line 1</Label>
                        <AddressAutocomplete
                          id={`address_line_1_${address.id}`}
                          debug={process.env.NODE_ENV === "development"}
                          value={address.address_line_1 || ""}
                          onChange={(v) =>
                            handleAddressChange(address.id, "address_line_1", v)
                          }
                          onAddressSelect={(addr) => {
                            handleAddressChange(
                              address.id,
                              "address_line_1",
                              addr.addressLine1 || addr.formattedAddress
                            );
                            if (addr.locality)
                              handleAddressChange(address.id, "city", addr.locality);
                            if (addr.administrativeAreaShort)
                              handleAddressChange(
                                address.id,
                                "state",
                                addr.administrativeAreaShort
                              );
                            if (addr.postalCode)
                              handleAddressChange(
                                address.id,
                                "zipcode",
                                addr.postalCode
                              );
                            if (addr.countryShort) {
                              const countryMap = {
                                us: "USA",
                                ca: "Canada",
                                gb: "United Kingdom",
                                au: "Australia",
                                de: "Germany",
                                fr: "France",
                                it: "Italy",
                                es: "Spain",
                                nl: "Netherlands",
                              };
                              const mapped =
                                countryMap[addr.countryShort.toLowerCase()];
                              handleAddressChange(
                                address.id,
                                "country",
                                mapped || "Other"
                              );
                              if (mapped) {
                                handleAddressChange(
                                  address.id,
                                  "countryOther",
                                  ""
                                );
                              } else {
                                handleAddressChange(
                                  address.id,
                                  "countryOther",
                                  addr.country || ""
                                );
                              }
                            }
                          }}
                          countryRestrictions={["us", "ca", "gb", "au", "de", "fr", "it", "es", "nl"]}
                          placeholder="Start typing to search address..."
                          className={
                            errors[`address_line_1_${address.id}`]
                              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                              : ""
                          }
                        />
                        {errors[`address_line_1_${address.id}`] && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors[`address_line_1_${address.id}`]}
                          </p>
                        )}
                      </div>
                      {renderInputWithError(
                        `address_line_2_${address.id}`,
                        "Address Line 2",
                        address.address_line_2,
                        (e) =>
                          handleAddressChange(
                            address.id,
                            "address_line_2",
                            e.target.value
                          ),
                        { placeholder: "Apartment, suite, etc." }
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderInputWithError(
                          `city_${address.id}`,
                          "City",
                          address.city,
                          (e) =>
                            handleAddressChange(
                              address.id,
                              "city",
                              e.target.value
                            ),
                          { placeholder: "Enter city" }
                        )}
                        {renderInputWithError(
                          `state_${address.id}`,
                          "State",
                          address.state,
                          (e) =>
                            handleAddressChange(
                              address.id,
                              "state",
                              e.target.value
                            ),
                          { placeholder: "Enter state" }
                        )}
                        {renderInputWithError(
                          `zipcode_${address.id}`,
                          "ZIP Code",
                          address.zipcode,
                          (e) =>
                            handleAddressChange(
                              address.id,
                              "zipcode",
                              e.target.value
                            ),
                          { placeholder: "Enter ZIP code" }
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        {renderSelectWithError(
                          `country_${address.id}`,
                          "Country",
                          address.country,
                          (value) => {
                            handleAddressChange(address.id, "country", value);
                            if (value !== "Other") {
                              handleAddressChange(
                                address.id,
                                "countryOther",
                                ""
                              );
                            }
                          },
                          <>
                            {popularCountries.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </>,
                          "Select country"
                        )}
                        {address.country === "Other" &&
                          renderInputWithError(
                            `countryOther_${address.id}`,
                            "Specify Country",
                            address.countryOther,
                            (e) =>
                              handleAddressChange(
                                address.id,
                                "countryOther",
                                e.target.value
                              ),
                            { placeholder: "Enter country name" }
                          )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guardian" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-teal-600" /> Parent/Guardian
                    Information
                    <Badge variant="secondary" className="ml-2">
                      Optional
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "parent_first_name",
                      "Parent/Guardian First Name",
                      formData.parent_first_name,
                      (e) =>
                        handleInputChange("parent_first_name", e.target.value),
                      { placeholder: "Enter first name" }
                    )}
                    {renderInputWithError(
                      "parent_last_name",
                      "Parent/Guardian Last Name",
                      formData.parent_last_name,
                      (e) =>
                        handleInputChange("parent_last_name", e.target.value),
                      { placeholder: "Enter last name" }
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "relationship_to_insured",
                      "Relationship to Client",
                      formData.relationship_to_insured,
                      (value) =>
                        handleInputChange("relationship_to_insured", value),
                      <>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Guardian">Guardian</SelectItem>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </>,
                      "Select relationship"
                    )}
                    {formData.relationship_to_insured === "Other" &&
                      renderInputWithError(
                        "relation_other",
                        "Specify Relationship",
                        formData.relation_other,
                        (e) =>
                          handleInputChange("relation_other", e.target.value),
                        { placeholder: "Enter relationship" }
                      )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-teal-600" /> Emergency
                    Contact
                    <Badge variant="secondary" className="ml-2">
                      Optional
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "emergency_contact_name",
                      "Emergency Contact Name",
                      formData.emergency_contact_name,
                      (e) =>
                        handleInputChange(
                          "emergency_contact_name",
                          e.target.value
                        ),
                      { placeholder: "Enter contact name" }
                    )}
                    {renderInputWithError(
                      "emg_relationship",
                      "Relationship",
                      formData.emg_relationship,
                      (e) =>
                        handleInputChange("emg_relationship", e.target.value),
                      { placeholder: "Enter relationship" }
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "emg_phone",
                      "Emergency Contact Phone",
                      formatUSPhone(formData.emg_phone),
                      (e) => handleInputChange("emg_phone", stripPhoneFormatting(e.target.value)),
                      { placeholder: "(123)-456-7890", maxLength: 14 }
                    )}
                    {renderInputWithError(
                      "emg_email",
                      "Emergency Contact Email",
                      formData.emg_email,
                      (e) => handleInputChange("emg_email", e.target.value),
                      { type: "email", placeholder: "Enter email address" }
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insurance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-teal-600" /> Insurance
                      Information
                      <Badge variant="secondary" className="ml-2">
                        Optional
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newIns = {
                          insurance_id: `temp_${Date.now()}`,
                          insurance_type: activeInsuranceTab || "Primary",
                          insurance_provider: "",
                          insurance_provider_id: "",
                          carrier_payer_id: "",
                          insurance_issue_date: "",
                          insurance_plan_name: "",
                          date_of_signature: "",
                          authorized_payment_box13: "Signature on File",
                          authorized_release_box12: "Signature on File",
                          authorized_release_box17: "Signature on File",
                          additional_claim_info_box19: "",
                          do_not_accept_assignment_box27: false,
                          insurance_notes: "",
                          primary_insurance_notes: "",
                          insured_same_as_client: true,
                          insurance_inactive: false,
                          primary_diagnosis: "",
                          treatment_type: "",
                          provider_staff_id: "",
                          start_date: "",
                          end_date: "",
                          insurance_id_number: "",
                          group_number: "",
                          coinsurance: "",
                          deductible: "",
                          copay_rate: "",
                        };
                        setFormData((prev) => ({
                          ...prev,
                          insurances: [...prev.insurances, newIns],
                        }));
                      }}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Insurance
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.insurances.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No insurance information added yet.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      <Tabs
                        value={activeInsuranceTab}
                        onValueChange={setActiveInsuranceTab}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="Primary">PRIMARY INSURANCE</TabsTrigger>
                          <TabsTrigger value="Secondary">SECONDARY INSURANCE</TabsTrigger>
                          <TabsTrigger value="Tertiary">TERTIARY INSURANCE</TabsTrigger>
                        </TabsList>

                        {["Primary", "Secondary", "Tertiary"].map((insuranceType) => {
                          const insurancesOfType = formData.insurances.filter(
                            (ins) => ins.insurance_type === insuranceType
                          );

                          if (insurancesOfType.length === 0) {
                            return (
                              <TabsContent key={insuranceType} value={insuranceType}>
                                <div className="text-center py-8 text-gray-500">
                                  No {insuranceType.toLowerCase()} insurance added yet.
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newIns = {
                                        insurance_id: `temp_${Date.now()}`,
                                        insurance_type: insuranceType,
                                        insurance_provider: "",
                                        insurance_provider_id: "",
                                        carrier_payer_id: "",
                                        insurance_issue_date: "",
                                        insurance_plan_name: "",
                                        date_of_signature: "",
                                        authorized_payment_box13: "Signature on File",
                                        authorized_release_box17: "Signature on File",
                                        additional_claim_info_box19: "",
                                        do_not_accept_assignment_box27: false,
                                        insurance_notes: "",
                                        primary_insurance_notes: "",
                                        insured_same_as_client: true,
                                        primary_diagnosis: "",
                                        treatment_type: "",
                                        provider_staff_id: "",
                                        start_date: "",
                                        end_date: "",
                                        insurance_id_number: "",
                                        group_number: "",
                                        coinsurance: "",
                                        deductible: "",
                                        copay_rate: "",
                                      };
                                      setFormData((prev) => ({
                                        ...prev,
                                        insurances: [...prev.insurances, newIns],
                                      }));
                                      setActiveInsuranceTab(insuranceType);
                                    }}
                                    className="mt-4"
                                  >
                                    <Plus className="h-4 w-4 mr-2" /> Add {insuranceType} Insurance
                                  </Button>
                                </div>
                              </TabsContent>
                            );
                          }

                          return (
                            <TabsContent key={insuranceType} value={insuranceType}>
                              <div className="space-y-6 mt-4">
                                {insurancesOfType.map((insurance, typeIndex) => {
                                  const index = formData.insurances.findIndex(
                                    (ins) => ins.insurance_id === insurance.insurance_id
                                  );

                                  return (
                                    <div key={insurance.insurance_id} className="border rounded-lg p-4 space-y-4">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">
                                          {insuranceType} Insurance #{typeIndex + 1}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          {typeIndex === insurancesOfType.length - 1 && (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                const newIns = {
                                                  insurance_id: `temp_${Date.now()}`,
                                                  insurance_type: insuranceType,
                                                  insurance_provider: "",
                                                  insurance_provider_id: "",
                                                  carrier_payer_id: "",
                                                  insurance_issue_date: "",
                                                  insurance_plan_name: "",
                                                  date_of_signature: "",
                                                  authorized_payment_box13: "Signature on File",
                                                  authorized_release_box17: "Signature on File",
                                                  additional_claim_info_box19: "",
                                                  do_not_accept_assignment_box27: false,
                                                  insurance_notes: "",
                                                  primary_insurance_notes: "",
                                                  insured_same_as_client: true,
                                                  primary_diagnosis: "",
                                                  treatment_type: "",
                                                  provider_staff_id: "",
                                                  start_date: "",
                                                  end_date: "",
                                                  insurance_id_number: "",
                                                  group_number: "",
                                                  coinsurance: "",
                                                  deductible: "",
                                                  copay_rate: "",
                                                };
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  insurances: [...prev.insurances, newIns],
                                                }));
                                              }}
                                              className="flex items-center gap-2 text-green-600 hover:text-green-700"
                                            >
                                              <Plus className="h-4 w-4" /> ADD ADDITIONAL {insuranceType.toUpperCase()} INSURANCE
                                            </Button>
                                          )}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              removeInsurance(insurance.insurance_id)
                                            }
                                            className="text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                {/* Insurance Company Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderSelectWithError(
                                    `insurance_insurance_provider_${index}`,
                                    "Insurance Company *",
                                    insurance.insurance_provider_id || "",
                                    (value) => {
                                      const selectedProvider = providers.find(p => p.id === value);
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_provider_id",
                                        value
                                      );
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_provider",
                                        selectedProvider?.provider_name || ""
                                      );
                                    },
                                    <>
                                      {providers
                                        .filter(p => !p.archived)
                                        .map((provider) => (
                                          <SelectItem key={provider.id} value={provider.id}>
                                            {provider.provider_name}
                                          </SelectItem>
                                        ))}
                                    </>,
                                    "Select provider"
                                  )}
                                  {renderInputWithError(
                                    `insurance_carrier_payer_id_${index}`,
                                    "Carrier Payer ID",
                                    insurance.carrier_payer_id,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "carrier_payer_id",
                                        e.target.value
                                      ),
                                    { placeholder: "Enter carrier payer ID" }
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderInputWithError(
                                    `insurance_group_number_${index}`,
                                    "Insurance Group Name/Number",
                                    insurance.group_number,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "group_number",
                                        e.target.value
                                      ),
                                    { placeholder: "Enter group name/number" }
                                  )}
                                  {renderInputWithError(
                                    `insurance_insurance_id_number_${index}`,
                                    "Insurance ID Number *",
                                    insurance.insurance_id_number,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_id_number",
                                        e.target.value
                                      ),
                                    { placeholder: "Enter ID number" }
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium cursor-pointer" onClick={() => {
                                    const textarea = document.getElementById(`insurance_primary_insurance_notes_${index}`);
                                    if (textarea) textarea.focus();
                                  }}>
                                    Primary Insurance Notes
                                  </Label>
                                  <Textarea
                                    id={`insurance_primary_insurance_notes_${index}`}
                                    value={insurance.primary_insurance_notes || ""}
                                    onChange={(e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "primary_insurance_notes",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter primary insurance notes"
                                    className="min-h-[80px]"
                                  />
                                </div>

                                {/* Insurance Dates */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderInputWithError(
                                    `insurance_insurance_issue_date_${index}`,
                                    "Insurance Issue Date",
                                    insurance.insurance_issue_date,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_issue_date",
                                        e.target.value
                                      ),
                                    { type: "date" }
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderInputWithError(
                                    `insurance_insurance_plan_name_${index}`,
                                    "Insurance Plan Name",
                                    insurance.insurance_plan_name,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_plan_name",
                                        e.target.value
                                      ),
                                    { placeholder: "Enter plan name" }
                                  )}
                                  {renderInputWithError(
                                    `insurance_end_date_${index}`,
                                    "Insurance Expiry date",
                                    insurance.end_date,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "end_date",
                                        e.target.value
                                      ),
                                    { type: "date" }
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderInputWithError(
                                    `insurance_date_of_signature_${index}`,
                                    "Date Of Signature",
                                    insurance.date_of_signature,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "date_of_signature",
                                        e.target.value
                                      ),
                                    { type: "date" }
                                  )}
                                </div>

                                {/* Authorization and Claim Information */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Authorization Release (Box 12)</Label>
                                    {renderSelectWithError(
                                      `insurance_authorized_release_box12_${index}`,
                                      "",
                                      insurance.authorized_release_box12 || "Signature on File",
                                      (value) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "authorized_release_box12",
                                          value
                                        ),
                                      <>
                                        <SelectItem value="Signature on File">Signature on File</SelectItem>
                                        <SelectItem value="No Signature on File">No Signature on File</SelectItem>
                                      </>,
                                      "Select option"
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Authorized Payment (Box 13)</Label>
                                    {renderSelectWithError(
                                      `insurance_authorized_payment_box13_${index}`,
                                      "",
                                      insurance.authorized_payment_box13 || "Signature on File",
                                      (value) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "authorized_payment_box13",
                                          value
                                        ),
                                      <>
                                        <SelectItem value="Signature on File">Signature on File</SelectItem>
                                        <SelectItem value="No Signature on File">No Signature on File</SelectItem>
                                      </>,
                                      "Select option"
                                    )}
                                    <p className="text-red-600 text-xs mt-1">
                                      If "No Signature on File" is selected for Box 12 and/or 13 then claims may be denied. Please make sure you have all necessary signatures on file prior to submission of claims.
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                  {renderInputWithError(
                                    `insurance_additional_claim_info_box19_${index}`,
                                    "Additional Claim Information (Box 19)",
                                    insurance.additional_claim_info_box19,
                                    (e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "additional_claim_info_box19",
                                        e.target.value
                                      ),
                                    { placeholder: "Enter additional claim information" }
                                  )}
                                </div>

                                {/* Assignment and General Notes */}
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`insurance_do_not_accept_assignment_box27_${index}`}
                                      checked={insurance.do_not_accept_assignment_box27 || false}
                                      onCheckedChange={(checked) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "do_not_accept_assignment_box27",
                                          checked
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`insurance_do_not_accept_assignment_box27_${index}`}
                                      className="cursor-pointer"
                                    >
                                      Do Not Accept Assignment (Box 27)
                                    </Label>
                                  </div>
                                  <p className="text-red-600 text-xs">
                                    (If "Do Not Accept Assignment" is checked then Mahaverse will select "No" for Box 27. This box should not be checked unless payment should go to the client instead of your organization.)
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Insurance Notes</Label>
                                  <Textarea
                                    value={insurance.insurance_notes || ""}
                                    onChange={(e) =>
                                      handleInsuranceChange(
                                        insurance.insurance_id,
                                        "insurance_notes",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter insurance notes"
                                    className="min-h-[80px]"
                                  />
                                </div>

                                {/* Client Relationship */}
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`insurance_insured_same_as_client_${index}`}
                                      checked={insurance.insured_same_as_client !== undefined ? insurance.insured_same_as_client : true}
                                      onCheckedChange={(checked) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "insured_same_as_client",
                                          checked
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`insurance_insured_same_as_client_${index}`}
                                      className="cursor-pointer"
                                    >
                                      Insured Person is the same person as the Client
                                    </Label>
                                  </div>
                                  <p className="text-red-600 text-xs">
                                    (If this box is checked then Mahaverse will select &quot;Self&quot; in box 6 of the CMS 1500 form.)
                                  </p>

                                  {!insurance.insured_same_as_client && (
                                    <div className="mt-4 p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
                                      <h5 className="font-medium text-sm text-slate-700">Insured Person Details</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(
                                          `insurance_insured_first_name_${index}`,
                                          "Insured First Name",
                                          insurance.insured_first_name || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_first_name", e.target.value),
                                          { placeholder: "First name" }
                                        )}
                                        {renderInputWithError(
                                          `insurance_insured_last_name_${index}`,
                                          "Insured Last Name",
                                          insurance.insured_last_name || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_last_name", e.target.value),
                                          { placeholder: "Last name" }
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderInputWithError(
                                          `insurance_insured_dob_${index}`,
                                          "Insured Date of Birth",
                                          insurance.insured_dob || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_dob", e.target.value),
                                          { type: "date" }
                                        )}
                                        {renderSelectWithError(
                                          `insurance_insured_gender_${index}`,
                                          "Insured Gender",
                                          insurance.insured_gender || "",
                                          (value) => handleInsuranceChange(insurance.insurance_id, "insured_gender", value),
                                          <>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Female">Female</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                          </>,
                                          "Select gender"
                                        )}
                                        {renderSelectWithError(
                                          `insurance_insured_relationship_${index}`,
                                          "Relationship to Client",
                                          insurance.insured_relationship || "",
                                          (value) => handleInsuranceChange(insurance.insurance_id, "insured_relationship", value),
                                          <>
                                            <SelectItem value="Spouse">Spouse</SelectItem>
                                            <SelectItem value="Parent">Parent</SelectItem>
                                            <SelectItem value="Child">Child</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                          </>,
                                          "Select relationship"
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(
                                          `insurance_insured_id_number_${index}`,
                                          "Insured ID Number",
                                          insurance.insured_id_number || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_id_number", e.target.value),
                                          { placeholder: "Insured ID #" }
                                        )}
                                        {renderInputWithError(
                                          `insurance_insured_phone_${index}`,
                                          "Insured Phone",
                                          formatUSPhone(insurance.insured_phone || ""),
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_phone", stripPhoneFormatting(e.target.value)),
                                          { placeholder: "(123)-456-7890", maxLength: 14 }
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 gap-4">
                                        <div>
                                          <Label htmlFor={`insurance_insured_address_${index}`}>
                                            Insured Address
                                          </Label>
                                          <AddressAutocomplete
                                            id={`insurance_insured_address_${index}`}
                                            debug={process.env.NODE_ENV === "development"}
                                            value={insurance.insured_address || ""}
                                            onChange={(v) =>
                                              handleInsuranceChange(
                                                insurance.insurance_id,
                                                "insured_address",
                                                v
                                              )
                                            }
                                            onAddressSelect={(addr) => {
                                              handleInsuranceChange(
                                                insurance.insurance_id,
                                                "insured_address",
                                                addr.addressLine1 ||
                                                  addr.formattedAddress ||
                                                  ""
                                              );
                                              if (addr.locality) {
                                                handleInsuranceChange(
                                                  insurance.insurance_id,
                                                  "insured_city",
                                                  addr.locality
                                                );
                                              }
                                              if (addr.administrativeAreaShort) {
                                                handleInsuranceChange(
                                                  insurance.insurance_id,
                                                  "insured_state",
                                                  addr.administrativeAreaShort
                                                );
                                              }
                                              if (addr.postalCode) {
                                                handleInsuranceChange(
                                                  insurance.insurance_id,
                                                  "insured_zipcode",
                                                  addr.postalCode
                                                );
                                              }
                                            }}
                                            countryRestrictions={["us", "ca", "gb", "au", "de", "fr", "it", "es", "nl"]}
                                            placeholder="Start typing to search address..."
                                            className={
                                              errors[`insurance_insured_address_${index}`]
                                                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
                                                : ""
                                            }
                                          />
                                          {errors[`insurance_insured_address_${index}`] && (
                                            <p className="text-red-500 text-sm mt-1">
                                              {errors[`insurance_insured_address_${index}`]}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderInputWithError(
                                          `insurance_insured_city_${index}`,
                                          "City",
                                          insurance.insured_city || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_city", e.target.value),
                                          { placeholder: "City" }
                                        )}
                                        {renderInputWithError(
                                          `insurance_insured_state_${index}`,
                                          "State",
                                          insurance.insured_state || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_state", e.target.value),
                                          { placeholder: "State" }
                                        )}
                                        {renderInputWithError(
                                          `insurance_insured_zipcode_${index}`,
                                          "Zip Code",
                                          insurance.insured_zipcode || "",
                                          (e) => handleInsuranceChange(insurance.insurance_id, "insured_zipcode", e.target.value),
                                          { placeholder: "Zip code" }
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Insurance Inactive */}
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`insurance_inactive_${index}`}
                                      checked={!!(insurance.insurance_inactive === 1 || insurance.insurance_inactive === "1" || insurance.insurance_inactive === true)}
                                      onCheckedChange={(checked) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "insurance_inactive",
                                          checked
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`insurance_inactive_${index}`}
                                      className="cursor-pointer"
                                    >
                                      Insurance Inactive
                                    </Label>
                                  </div>
                                </div>

                                {/* Legacy fields - keeping for backward compatibility */}
                                <div className="border-t pt-4 space-y-4">
                                  <h5 className="font-medium text-sm text-gray-600">Additional Information</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderSelectWithError(
                                      `insurance_primary_diagnosis_${index}`,
                                      "Primary Diagnosis",
                                      insurance.primary_diagnosis || "",
                                      (value) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "primary_diagnosis",
                                          value
                                        ),
                                      <>
                                        {diagnosisCodes
                                          .filter(d => !d.archived)
                                          .map((diag) => (
                                            <SelectItem key={diag.id} value={diag.diagnosis_code}>
                                              {diag.diagnosis_code} - {diag.diagnosis_description}
                                            </SelectItem>
                                          ))}
                                      </>,
                                      "Select primary diagnosis"
                                    )}
                                    {renderSelectWithError(
                                      `insurance_treatment_type_${index}`,
                                      "Treatment Type",
                                      insurance.treatment_type || "",
                                      (value) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "treatment_type",
                                          value
                                        ),
                                      <>
                                        {treatmentTypes.length > 0 ? (
                                          treatmentTypes
                                            .filter((t) => t.active === 1)
                                            .map((t) => (
                                              <SelectItem key={t.id} value={t.treatment_name}>
                                                {t.treatment_name}
                                              </SelectItem>
                                            ))
                                        ) : (
                                          <>
                                            <SelectItem value="Behavioral therapy">Behavioral therapy</SelectItem>
                                            <SelectItem value="Speech therapy">Speech therapy</SelectItem>
                                            <SelectItem value="Occupational therapy">Occupational therapy</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                          </>
                                        )}
                                      </>,
                                      "Select treatment type"
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderSelectWithError(
                                      `insurance_provider_staff_id_${index}`,
                                      "Rendering Provider",
                                      insurance.provider_staff_id,
                                      (value) => {
                                        const selectedStaff = filteredStaff?.find(
                                          (s) => String(s.id) === String(value)
                                        );
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "provider_staff_id",
                                          value
                                        );
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "rendering_provider",
                                          selectedStaff
                                            ? `${selectedStaff.firstName} ${selectedStaff.lastName}`
                                            : ""
                                        );
                                      },
                                      <>
                                        {filteredStaff.length === 0 ? null : (
                                          filteredStaff.map((staff) => (
                                            <SelectItem key={staff.id} value={staff.id}>
                                              {staff.firstName} {staff.lastName} ({staff.staffType})
                                            </SelectItem>
                                          ))
                                        )}
                                      </>,
                                      filteredStaff.length === 0 ? "No BCBA/BCaBA staff available" : "Select rendering provider"
                                    )}
                                    {renderInputWithError(
                                      `insurance_start_date_${index}`,
                                      "Start Date",
                                      insurance.start_date,
                                      (e) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "start_date",
                                          e.target.value
                                        ),
                                      { type: "date" }
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {renderInputWithError(
                                      `insurance_coinsurance_${index}`,
                                      "Coinsurance",
                                      insurance.coinsurance,
                                      (e) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "coinsurance",
                                          e.target.value
                                        ),
                                      { placeholder: "e.g., 20%" }
                                    )}
                                    {renderInputWithError(
                                      `insurance_deductible_${index}`,
                                      "Deductible",
                                      insurance.deductible,
                                      (e) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "deductible",
                                          e.target.value
                                        ),
                                      { placeholder: "e.g., $500" }
                                    )}
                                    {renderInputWithError(
                                      `insurance_copay_rate_${index}`,
                                      "Copay Rate",
                                      insurance.copay_rate,
                                      (e) =>
                                        handleInsuranceChange(
                                          insurance.insurance_id,
                                          "copay_rate",
                                          e.target.value
                                        ),
                                      { placeholder: "e.g., $25" }
                                    )}
                                  </div>
                                </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="configureData" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-teal-600" />
                    Configure data
                    <Badge variant="secondary" className="ml-2">
                      Client-specific
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Set up Skill Acquisition (domains, programs, targets) and review Behavior Reduction
                    notes for this client.
                  </p>
                </CardHeader>
                <CardContent>
                  <ClientConfigureDataPanel
                    clientId={
                      editingClient?.client_id ||
                      editingClient?.id ||
                      formData.client_id ||
                      ""
                    }
                    clientName={
                      `${formData.first_name || ""} ${formData.last_name || ""}`.trim() ||
                      "Client"
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="authorization" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Authorizations
                    <Badge variant="secondary" className="ml-2">Optional</Badge>
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Add multiple authorizations per insurance. Expand rows to manage service codes.
                  </p>
                </CardHeader>
                <CardContent>
                  {!formData.insurances || formData.insurances.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Add at least one insurance first.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {formData.insurances.map((insurance, insIdx) => {
                        const allForInsurance = (formData.authorizations || []).filter(
                          (a) => String(a.insurance_id) === String(insIdx)
                        );
                        const groupsMap = new Map();
                        allForInsurance.forEach((auth) => {
                          const gid = auth.auth_group_id || auth.auth_uuid;
                          if (!groupsMap.has(gid)) {
                            groupsMap.set(gid, []);
                          }
                          groupsMap.get(gid).push(auth);
                        });
                        const groups = Array.from(groupsMap.entries()).map(([gid, rows]) => ({
                          groupKey: gid,
                          rows,
                          first: rows[0],
                        }));
                        const today = new Date().toISOString().slice(0, 10);
                        const activeGroups = groups.filter(
                          (g) => !g.first.end_date || g.first.end_date >= today
                        );
                        const expiredGroups = groups.filter(
                          (g) => g.first.end_date && g.first.end_date < today
                        );
                        const providerId = insurance?.insurance_provider_id;
                        const providerMappings = providerServiceCodeMappings.filter(
                          (m) => String(m.provider_id) === String(providerId) && m.status === "Active" &&
                            (m.archived === 0 || m.archived === false) && (m.service_code || m.code)
                        );
                        const relevantMappings = providerMappings.length > 0
                          ? providerMappings
                          : (allServiceCodes || []).map((sc) => ({
                              service_code: sc.code,
                              code_description: sc.code_description || "",
                            }));

                        const renderAuthTable = (sectionGroups, sectionLabel) => {
                          if (sectionGroups.length === 0) return null;
                          return (
                            <div key={sectionLabel} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                  {sectionLabel}
                                </h4>
                                <Badge variant="outline" className="text-[11px]">
                                  {sectionGroups.length} {sectionGroups.length === 1 ? "Group" : "Groups"}
                                </Badge>
                              </div>
                              <div className="border rounded-xl bg-white overflow-hidden">
                                <div className="overflow-x-auto md:overflow-x-visible">
                                <table className="w-full table-fixed text-sm">
                                  <thead>
                                    <tr className="bg-slate-100 border-b text-left">
                                      <th className="w-10 p-3" />
                                      <th className="w-[15%] p-3 font-medium">Auth #</th>
                                      <th className="w-[24%] p-3 font-medium">Title</th>
                                      <th className="w-[18%] p-3 font-medium">Insurance Company</th>
                                      <th className="w-[18%] p-3 font-medium">Start Date</th>
                                      <th className="w-[18%] p-3 font-medium">End Date</th>
                                      <th className="w-[11%] p-3 text-center">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sectionGroups.map(({ groupKey, rows, first }) => {
                                      const isExpanded = expandedAuthKeys.has(groupKey);
                                      const title =
                                        first.authorization_number && (first.start_date || first.end_date)
                                          ? `Auth ${first.authorization_number} Dated ${first.start_date || "…"} - ${first.end_date || "…"}`
                                          : first.authorization_number || "—";
                                      return (
                                        <Fragment key={groupKey}>
                                          <tr key={groupKey} className="border-b align-top hover:bg-slate-50/60">
                                            <td className="p-3">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                  setExpandedAuthKeys((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(groupKey)) next.delete(groupKey);
                                                    else next.add(groupKey);
                                                    return next;
                                                  });
                                                }}
                                              >
                                                {isExpanded ? (
                                                  <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4" />
                                                )}
                                              </Button>
                                            </td>
                                            <td className="p-3">
                                              <Input
                                                value={first.authorization_number || ""}
                                                onChange={(e) =>
                                                  handleAuthGroupFieldChange(groupKey, "authorization_number", e.target.value)
                                                }
                                                placeholder="Auth #"
                                                className="h-9 text-xs w-full"
                                              />
                                            </td>
                                            <td className="p-3 text-slate-700" title={title}>
                                              <p className="truncate text-sm font-medium">
                                                {title}
                                              </p>
                                            </td>
                                            <td className="p-3 text-slate-600 break-words">
                                              {insurance.insurance_provider || `Insurance #${insIdx + 1}`}
                                            </td>
                                            <td className="p-3">
                                              <Input
                                                type="date"
                                                value={first.start_date || ""}
                                                onChange={(e) =>
                                                  handleAuthGroupFieldChange(groupKey, "start_date", e.target.value)
                                                }
                                                className="h-9 text-xs w-full min-w-[150px] pr-8"
                                              />
                                            </td>
                                            <td className="p-3">
                                              <Input
                                                type="date"
                                                value={first.end_date || ""}
                                                onChange={(e) =>
                                                  handleAuthGroupFieldChange(groupKey, "end_date", e.target.value)
                                                }
                                                className="h-9 text-xs w-full min-w-[150px] pr-8"
                                              />
                                            </td>
                                            <td className="p-3">
                                              <div className="flex items-center justify-center gap-1">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                                  onClick={() => {
                                                    setExpandedAuthKeys((prev) =>
                                                      new Set(prev).add(groupKey)
                                                    );
                                                  }}
                                                  title="Edit"
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                  onClick={() => removeAuthGroup(groupKey)}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                          {isExpanded && (
                                            <tr key={`${groupKey}-expanded`}>
                                              <td colSpan={7} className="p-0 bg-slate-50/80">
                                                <div className="px-5 py-4">
                                                  <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-600 pb-2 border-b mb-3">
                                                    <div className="col-span-2">Service Code</div>
                                                    <div className="col-span-2">Units Approved</div>
                                                    <div className="col-span-2">Units Completed</div>
                                                    <div className="col-span-2">Units Scheduled</div>
                                                    <div className="col-span-2">Units Remaining</div>
                                                    <div className="col-span-2" />
                                                  </div>
                                                  {rows.map((auth) => {
                                                    const flatIndex = formData.authorizations.findIndex(
                                                      (a) => a.auth_uuid === auth.auth_uuid
                                                    );
                                                    const approved =
                                                      Number.parseFloat(auth.units_approved_per_15_min) || 0;
                                                    const serviced =
                                                      Number.parseFloat(auth.units_serviced) || 0;
                                                    const balance =
                                                      approved - serviced;
                                                    const hours = (v) =>
                                                      (Number.parseFloat(v) / 4).toFixed(2);
                                                    return (
                                                      <div
                                                        key={auth.auth_uuid}
                                                        className="grid grid-cols-12 gap-3 items-start py-2"
                                                      >
                                                        <div className="col-span-2">
                                                          <Select
                                                            value={auth.billing_codes || ""}
                                                            onValueChange={(v) =>
                                                              handleAuthorizationChange(flatIndex, "billing_codes", v)
                                                            }
                                                          >
                                                            <SelectTrigger className="h-9 text-xs bg-white">
                                                              <SelectValue placeholder="Code" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              {relevantMappings.map((m) => (
                                                                <SelectItem
                                                                  key={m.id || m.service_code}
                                                                  value={m.service_code}
                                                                >
                                                                  {m.service_code} - {m.code_description || "N/A"}
                                                                </SelectItem>
                                                              ))}
                                                            </SelectContent>
                                                          </Select>
                                                        </div>
                                                        <div className="col-span-2">
                                                          <Input
                                                            type="number"
                                                            value={auth.units_approved_per_15_min || ""}
                                                            onChange={(e) =>
                                                              handleAuthorizationChange(
                                                                flatIndex,
                                                                "units_approved_per_15_min",
                                                                e.target.value
                                                              )
                                                            }
                                                            placeholder="Approved"
                                                            className="h-9 text-xs bg-white"
                                                          />
                                                          {auth.units_approved_per_15_min && (
                                                            <span className="text-[10px] text-slate-500 block">
                                                              {hours(auth.units_approved_per_15_min)} Hour(s)
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="col-span-2">
                                                          <Input
                                                            type="number"
                                                            value={auth.units_serviced || ""}
                                                            readOnly
                                                            placeholder="Completed"
                                                            className="h-9 text-xs bg-slate-100"
                                                          />
                                                          {auth.units_serviced && (
                                                            <span className="text-[10px] text-slate-500 block">
                                                              {hours(auth.units_serviced)} Hour(s)
                                                            </span>
                                                          )}
                                                          {auth.ready_to_bill_sessions?.length > 0 && (
                                                            <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                                                              {auth.ready_to_bill_sessions.map((sess) => (
                                                                <div key={sess.session_id}>
                                                                  {sess.service_date}: {sess.units} u
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                        <div className="col-span-2 text-slate-600 pt-2">
                                                          0
                                                          <span className="text-[10px] text-slate-500 block">
                                                            0 Hour
                                                          </span>
                                                        </div>
                                                        <div className="col-span-2 font-semibold pt-2">
                                                          {balance.toFixed(2)}
                                                          <span className="text-[10px] text-slate-500 block">
                                                            {(balance / 4).toFixed(2)} Hour(s)
                                                          </span>
                                                        </div>
                                                        <div className="col-span-2 flex justify-end">
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-red-600"
                                                            onClick={() => removeAuthorization(auth.auth_uuid)}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-3 h-9 flex items-center gap-1 bg-white"
                                                    onClick={() => addServiceCodeToAuth(insIdx, groupKey)}
                                                  >
                                                    <Plus className="h-3.5 w-3.5" /> Add Service Code
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                </div>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div key={`auth-insurance-${insIdx}`} className="border rounded-xl p-5 bg-slate-50/60 space-y-5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <h4 className="font-semibold text-teal-800">
                                  {insurance.insurance_provider || `Insurance #${insIdx + 1}`}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  Manage authorization groups and service code limits.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addNewAuthorization(insIdx)}
                                className="h-9 flex items-center gap-2 bg-white"
                              >
                                <Plus className="h-4 w-4" /> Add Authorization
                              </Button>
                            </div>
                            {groups.length === 0 ? (
                              <p className="text-slate-500 text-sm py-4">
                                No authorizations yet. Click &quot;Add Authorization&quot; to add one.
                              </p>
                            ) : (
                              <>
                                {renderAuthTable(activeGroups, "Insurance Authorizations")}
                                {renderAuthTable(expiredGroups, "Expired Authorizations")}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="availability" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" /> Weekly Availability
                    <Badge variant="secondary" className="ml-2">
                      Optional
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Set available hours for each day. Add multiple time slots per day as needed.
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Visual summary bar */}
                  <div className="flex gap-1 mb-4">
                    {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                      <div
                        key={day}
                        className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                          formData[`${day}Available`]
                            ? "bg-teal-100 text-teal-700 border border-teal-200"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        {dayAbbrevs[day]}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {renderDayAvailability("monday", "Monday")}
                    {renderDayAvailability("tuesday", "Tuesday")}
                    {renderDayAvailability("wednesday", "Wednesday")}
                    {renderDayAvailability("thursday", "Thursday")}
                    {renderDayAvailability("friday", "Friday")}
                    {renderDayAvailability("saturday", "Saturday")}
                    {renderDayAvailability("sunday", "Sunday")}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <File className="h-5 w-5 text-teal-600" /> Documents
                      <Badge variant="secondary" className="ml-2">
                        Optional
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDocument}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Document
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.documents.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No documents added yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {formData.documents.map((doc, index) => (
                        <div
                          key={`${doc.doc_uuid || "doc"}_${index}`}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">
                              {(doc?.document_type && String(doc.document_type).trim()) ||
                                getDocumentDisplayName(doc, index)}
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeDocument(doc.doc_uuid)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderSelectWithError(
                              `document_document_type_${index}`,
                              "Document Type",
                              doc.document_type || "",
                              (value) =>
                                handleDocumentChange(
                                  doc.doc_uuid,
                                  "document_type",
                                  value
                                ),
                              <>
                                {documentTypes.length > 0 ? (
                                  documentTypes
                                    // Coerce active to number to avoid `"1" !== 1` causing blank option lists.
                                    .filter((dt) => Number(dt.active) === 1)
                                    .map((dt) => (
                                      <SelectItem key={dt.id} value={dt.type_name}>
                                        {dt.type_name}
                                      </SelectItem>
                                    ))
                                ) : (
                                  fallbackDocumentTypes.map((dt) => (
                                    <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                                  ))
                                )}
                                {/* If the document has an existing type that isn't in the active master list,
                                    keep it selectable so the edit screen doesn't appear blank. */}
                                {doc.document_type &&
                                documentTypes.length > 0 &&
                                !documentTypes.some(
                                  (dt) => Number(dt.active) === 1 && dt.type_name === doc.document_type
                                ) ? (
                                  <SelectItem value={doc.document_type}>
                                    {doc.document_type} (from database)
                                  </SelectItem>
                                ) : null}
                              </>,
                              "Select document type"
                            )}
                          </div>
                          
                          {/* Document File Upload */}
                          <div className="mt-4">
                            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                              Upload Document
                            </Label>
                            {doc.document_file ||
                            doc.document_path?.trim() ||
                            doc.document_filename?.trim() ? (
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3 flex-1">
                                  <File className="h-5 w-5 text-teal-600" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                      {doc.document_file?.name ||
                                        doc.document_original_filename ||
                                        doc.document_filename ||
                                        getDocumentDisplayName(doc, index)}
                                    </p>
                                    {doc.document_type && (
                                      <Badge variant="secondary" className="mt-1">
                                        {doc.document_type}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {doc.document_path && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setViewingDocument({
                                            path: doc.document_path,
                                            filename: doc.document_original_filename || doc.document_filename || 'document',
                                            documentFilename: doc.document_filename, // Drive file ID if stored in Drive
                                          });
                                        }}
                                        className="text-teal-600 hover:text-teal-700"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            let downloadUrl;
                                            const path = doc.document_path || "";
                                            const isDrivePath = path.startsWith('drive://');
                                            const driveFileId = isDrivePath
                                              ? (doc.document_filename && String(doc.document_filename).trim()
                                                ? doc.document_filename
                                                : path.slice('drive://'.length))
                                              : null;

                                            if (driveFileId) {
                                              const params = new URLSearchParams();
                                              params.set('file_id', driveFileId);
                                              if (doc.document_original_filename) {
                                                params.set('filename', doc.document_original_filename);
                                              }
                                              downloadUrl = baseUrl ? `${baseUrl}/download-client-document.php?${params.toString()}` : null;
                                            } else if (path.startsWith('http')) {
                                              downloadUrl = path;
                                            } else if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
                                              const params = new URLSearchParams();
                                              params.set('path', path.startsWith('/') ? path.slice(1) : path);
                                              if (doc.document_original_filename) {
                                                params.set('filename', doc.document_original_filename);
                                              }
                                              downloadUrl = baseUrl ? `${baseUrl}/download-client-upload.php?${params.toString()}` : null;
                                            } else {
                                              alert('No downloadable file found for this document.');
                                              return;
                                            }

                                            if (!downloadUrl) {
                                              alert('Backend URL (NEXT_PUBLIC_BASE_URL) is not configured. Please set it to enable document downloads.');
                                              return;
                                            }
                                            const response = await fetch(downloadUrl, { credentials: 'omit' });
                                            if (!response.ok) {
                                              let errMsg = `Download failed (${response.status})`;
                                              const ct = response.headers.get('content-type');
                                              const errText = await response.text().catch(() => '');
                                              if (ct && ct.includes('application/json') && errText) {
                                                try {
                                                  const j = JSON.parse(errText);
                                                  errMsg = j.message || errMsg;
                                                } catch { /* use errMsg */ }
                                              } else if (errText) errMsg = errText;
                                              throw new Error(errMsg);
                                            }
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = doc.document_original_filename || doc.document_filename || 'document';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(url);
                                          } catch (error) {
                                            console.error('Download error:', error);
                                            alert('Failed to download file: ' + (error?.message || 'Please try again.'));
                                          }
                                        }}
                                        className="text-blue-600 hover:text-blue-700"
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveDocumentFile(doc.doc_uuid)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    title="Remove file"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <Label htmlFor={`document-file-${index}`} className="cursor-pointer">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Upload className="h-8 w-8 text-gray-400" />
                                    <span className="text-sm text-gray-600">Click to upload or drag and drop</span>
                                    <span className="text-xs text-gray-500">PDF, JPG, or PNG (max 25MB)</span>
                                  </div>
                                </Label>
                                <Input
                                  id={`document-file-${index}`}
                                  type="file"
                                  accept="application/pdf,image/jpeg,image/jpg,image/png"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleDocumentFileSelect(doc.doc_uuid, file);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Notes &
                    Additional Information
                    <Badge variant="secondary" className="ml-2">
                      Optional
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="client_notes">Client Notes</Label>
                    <Textarea
                      id="client_notes"
                      value={formData.client_notes}
                      onChange={(e) =>
                        handleInputChange("client_notes", e.target.value)
                      }
                      placeholder="Enter any notes about the client..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="other_information">Other Information</Label>
                    <Textarea
                      id="other_information"
                      value={formData.other_information}
                      onChange={(e) =>
                        handleInputChange("other_information", e.target.value)
                      }
                      placeholder="Enter any additional information..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between gap-3 pt-6 border-t">
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {activeTab !== "personal" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviousTab}
                >
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {saving
                  ? "Saving..."
                  : isLastTab || !editingClient
                  ? editingClient
                    ? "Update Client"
                    : "Add Client"
                  : "Save & Continue"}
              </Button>
              {!isLastTab && (
                <Button type="button" onClick={handleNextTab} variant="outline">
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
      {viewingDocument && (
        <DocumentViewerModal
          isOpen={!!viewingDocument}
          documentPath={viewingDocument.path}
          filename={viewingDocument.filename}
          documentFilename={viewingDocument.documentFilename}
          baseUrl={baseUrl}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </Dialog>
  );
}
