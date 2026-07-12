import { FormData as StaffFormData, ApiResponse, ClientIntakeData } from './types';

function getLaunchpadBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_LAUNCHPAD_BASE_PATH || '/launchpad';
  // Normalize: '' | '/launchpad' (no trailing slash)
  const base = raw === '/' ? '' : String(raw).replace(/\/+$/, '');
  return base || '';
}

/**
 * Launchpad PHP backend origin (no trailing slash). Used by Launchpad fetches and Role Access RBAC.
 * Order: NEXT_PUBLIC_LAUNCHPAD_API_URL → NEXT_PUBLIC_API_URL → same-origin (if flag) → production default.
 */
export function getLaunchpadApiOrigin(): string {
  // Prefer explicit env var (recommended)
  // - NEXT_PUBLIC_LAUNCHPAD_API_URL: Launchpad backend origin (e.g. https://launchpad.mahabehavioralhealth.com)
  // - NEXT_PUBLIC_API_URL: legacy env name from Launchpad
  const envLaunchpad = process.env.NEXT_PUBLIC_LAUNCHPAD_API_URL;
  if (envLaunchpad && envLaunchpad.trim()) return envLaunchpad.trim().replace(/\/+$/, '');

  const envLegacy = process.env.NEXT_PUBLIC_API_URL;
  if (envLegacy && envLegacy.trim()) return envLegacy.trim().replace(/\/+$/, '');

  // Default behavior:
  // - If you want integrated same-origin backend, set NEXT_PUBLIC_LAUNCHPAD_USE_SAME_ORIGIN=true
  // - Otherwise, default to the existing/old Launchpad domain (works in local dev too)
  const useSameOrigin = String(process.env.NEXT_PUBLIC_LAUNCHPAD_USE_SAME_ORIGIN || '').toLowerCase() === 'true';
  if (useSameOrigin && typeof window !== 'undefined') {
    return `${window.location.origin}${getLaunchpadBasePath()}`.replace(/\/+$/, '');
  }

  return 'https://launchpad.mahabehavioralhealth.com';
}

const API_BASE_URL = getLaunchpadApiOrigin();

type EnsureAuthResult = { success: boolean; user?: any; message?: string };

function getMahaverseSession(): { ok: boolean; email?: string } {
  if (typeof window === 'undefined') return { ok: false };
  const userStr = localStorage.getItem('aba_user');
  const expiresAt = localStorage.getItem('aba_token_expiry');
  if (!userStr || !expiresAt) return { ok: false };
  const expiryTime = new Date(expiresAt);
  if (Number.isNaN(expiryTime.getTime()) || new Date() >= expiryTime) return { ok: false };
  try {
    const user = JSON.parse(userStr);
    const email = String(user?.email || '').trim();
    if (!email) return { ok: false };
    return { ok: true, email };
  } catch {
    return { ok: false };
  }
}

// Ensure Launchpad auth exists.
// If Launchpad token is missing but Mahaverse session exists, mint a Launchpad token via /backend/sso_login.php.
export async function ensureAuth(): Promise<EnsureAuthResult> {
  const existing = checkAuth();
  if (existing.success) return { success: true, user: existing.user };

  if (typeof window === 'undefined') return { success: false, message: 'No window' };

  const maha = getMahaverseSession();
  if (!maha.ok || !maha.email) return { success: false, message: 'Not logged into Mahaverse' };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = process.env.NEXT_PUBLIC_LAUNCHPAD_SSO_SECRET;
    if (secret && secret.trim()) {
      headers['X-SSO-Secret'] = secret.trim();
    }

    const resp = await fetch(`${API_BASE_URL}/backend/sso_login.php`, {
      method: 'POST',
      headers,
      // Token-based auth; do not rely on cross-site cookies (avoids CORS credential restrictions).
      credentials: 'omit',
      body: JSON.stringify({ email: maha.email }),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data?.success && data?.token && data?.user && data?.expires_at) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_expires_at', data.expires_at);
      return { success: true, user: data.user };
    }

    return { success: false, message: data?.message || data?.error || 'SSO login failed' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'SSO login error' };
  }
}

export async function login(emailOrUsername: string, password: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/backend/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: emailOrUsername,
        password: password,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      // Store token and user data in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        localStorage.setItem('auth_expires_at', data.expires_at);
      }
      return {
        success: true,
        message: 'Login successful',
        user: data.user,
        token: data.token,
      };
    } else {
      return {
        success: false,
        message: data.error || 'Login failed. Please try again.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Network error. Please try again.',
    };
  }
}

export async function logout(): Promise<ApiResponse> {
  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_expires_at');
  }

  // Best-effort server-side session logout
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    await fetch(`${API_BASE_URL}/backend/logout.php`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
  } catch (e) {
    // ignore
  }

  return {
    success: true,
    message: 'Logout successful',
  };
}

// Check auth from localStorage (token-based)
export function checkAuth(): { success: boolean; user?: any } {
  if (typeof window === 'undefined') {
    return { success: false };
  }

  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');
  const expiresAt = localStorage.getItem('auth_expires_at');

  if (!token || !userStr || !expiresAt) {
    return { success: false };
  }

  // Check if token is expired
  const expiryTime = new Date(expiresAt);
  const now = new Date();

  if (now >= expiryTime) {
    // Token expired, clear storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_expires_at');
    return { success: false };
  }

  try {
    const user = JSON.parse(userStr);
    return { success: true, user };
  } catch (error) {
    return { success: false };
  }
}

// Get auth token from localStorage (used as CSRF token in token-based auth)
export function getCsrfToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('auth_token');
}

// -----------------------------
// Google Drive (Admin/HR only)
// -----------------------------

export function getDriveOAuthStartUrl(opts?: { returnTo?: string }): string {
  const params = new URLSearchParams();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) params.set('token', token); // fallback for cross-origin redirects
  if (opts?.returnTo) params.set('return_to', opts.returnTo);
  return `${API_BASE_URL}/backend/drive_oauth_start.php?${params.toString()}`;
}

export async function getDriveOAuthLink(opts?: { returnTo?: string }): Promise<{ success: boolean; auth_url?: string; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const params = new URLSearchParams();
    if (opts?.returnTo) params.set('return_to', opts.returnTo);

    const resp = await fetch(`${API_BASE_URL}/backend/drive_oauth_link.php?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    return await resp.json();
  } catch (e) {
    return { success: false, message: 'Network error' };
  }
}

export async function getDriveStatus(): Promise<{
  success: boolean;
  enabled?: boolean;
  auth_mode?: string;
  connected?: boolean;
  connected_by?: string | null;
  updated_at?: string | null;
  message?: string;
}> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const resp = await fetch(`${API_BASE_URL}/backend/drive_oauth_status.php`, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    return await resp.json();
  } catch (e) {
    return { success: false, message: 'Network error' };
  }
}

export async function disconnectDrive(): Promise<{ success: boolean; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const resp = await fetch(`${API_BASE_URL}/backend/drive_oauth_disconnect.php`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    return await resp.json();
  } catch (e) {
    return { success: false, message: 'Network error' };
  }
}

// Forgot Password - Send OTP
export async function sendOtp(email: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/backend/send-otp.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

// Verify OTP
export async function verifyOtp(email: string, otp: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/backend/verify-otp.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

// Reset Password with OTP
export async function resetPasswordWithOtp(email: string, otp: string, newPassword: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/backend/reset-password-with-otp.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error. Please try again.',
    };
  }
}

export async function submitForm(formData: StaffFormData, csrfToken: string): Promise<ApiResponse> {
  const payload = new globalThis.FormData();

  // Staff
  if (formData.staffId) payload.append('staffId', String(formData.staffId));
  payload.append('formType', formData.formType);
  payload.append('firstName', formData.firstName);
  payload.append('middleName', formData.middleName);
  payload.append('lastName', formData.lastName);
  payload.append('jobTitle', formData.jobTitle);
  payload.append('employmentStatus', formData.employmentStatus);
  payload.append('ssn', formData.ssn);
  payload.append('dob', formData.dob);
  payload.append('fullAddress', formData.fullAddress);
  payload.append('cellPhone', formData.cellPhone);
  payload.append('homeWorkPhone', formData.homeWorkPhone);
  payload.append('email', formData.email);

  // Emergency Contact
  payload.append('emergencyName', formData.emergencyName);
  payload.append('relationship', formData.relationship);
  payload.append('primaryPhone', formData.primaryPhone);
  payload.append('secondaryPhone', formData.secondaryPhone);

  // Professional Data
  payload.append('highestDegree', formData.highestDegree);
  payload.append('yearAwarded', formData.yearAwarded);
  payload.append('major', formData.major);
  payload.append('licenseStatus', formData.licenseStatus);
  payload.append('licenseExpDate', formData.licenseExpDate);
  payload.append('npiNumber', formData.npiNumber);
  payload.append('languages', formData.languages);
  payload.append('specialtyAreas', formData.specialtyAreas);
  payload.append('certTypes', formData.certTypes.join('|'));
  payload.append('certNumber', formData.certNumber);
  payload.append('certExpDate', formData.certExpDate);

  // Attachments
  if (formData.cprUpload) payload.append('cprUpload', formData.cprUpload);
  if (formData.certificateUpload) payload.append('certificateUpload', formData.certificateUpload);
  if (formData.hasExistingCpr) payload.append('hasExistingCpr', '1');
  if (formData.hasExistingCertificate) payload.append('hasExistingCertificate', '1');

  // Bank Info
  payload.append('bankName', formData.bankName);
  payload.append('accountName', formData.accountName);
  payload.append('accountNumber', formData.accountNumber);
  payload.append('routingNumber', formData.routingNumber);
  payload.append('accountType', formData.accountType);
  payload.append('payrollAuth', formData.payrollAuth ? '1' : '0');

  // Compliance
  payload.append('hipaaAck', formData.hipaaAck ? '1' : '0');
  payload.append('abuseAck', formData.abuseAck ? '1' : '0');
  payload.append('digitalSignature', formData.digitalSignature);
  payload.append('signatureDate', formData.signatureDate);

  // CSRF
  payload.append('csrf_token', csrfToken);

  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/submit_form.php`, {
      method: 'POST',
      headers: {
        // IMPORTANT: do not set Content-Type for multipart; browser will set boundary.
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: payload,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      title: 'Submission Failed',
      message: 'There was a problem submitting the form. Please try again.',
    };
  }
}

export async function submitClientIntake(intakeData: ClientIntakeData): Promise<ApiResponse & { intake_id?: number }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/submit_client_intake.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(intakeData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      title: 'Submission Failed',
      message: 'There was a problem submitting the client intake form. Please try again.',
    };
  }
}

export interface StaffCertification {
  cert_type: string;
  cert_number: string | null;
  exp_date: string | null;
}

export interface StaffAttachment {
  attachment_id: number;
  attachment_type: string; // 'CPR', 'CERTIFICATE', or 'SIGNATURE'
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface StaffListItem {
  staff_id: number;
  action_type?: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  job_title?: string | null;
  employment_status?: string | null;
  created_by_user_id?: number | null;
  created_by_username?: string | null;
  created_by_role?: string | null;
  offer_initiated_at?: string | null;
  offer_accepted_at?: string | null;
  ssn_last_4_digits: string | null;
  ssn_full?: string | null;
  date_of_birth: string | null;
  full_address: string | null;
  cell_phone: string | null;
  home_phone: string | null;
  work_phone: string | null;
  email: string;
  emergency_contact_name: string | null;
  emergency_relationship: string | null;
  emergency_primary_phone: string | null;
  emergency_secondary_phone: string | null;
  highest_degree: string | null;
  year_awarded: string | null;
  major: string | null;
  license_status: string | null;
  license_exp_date: string | null;
  npi_number: string | null;
  languages: string | null;
  specialty_areas: string | null;
  certifications: StaffCertification[];
  attachments?: StaffAttachment[];
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  account_type: string | null;
  authorization_agreed: number | null;
  hipaa_acknowledged: number | null;
  hipaa_acknowledged_at: string | null;
  abuse_reporting_acknowledged: number | null;
  abuse_reporting_acknowledged_at: string | null;
}

export async function listMyStaff(opts?: {
  userId?: number;
  name?: string;
  share_key?: string;
}): Promise<{ success: boolean; staff?: StaffListItem[]; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const params = new URLSearchParams();
    if (opts?.userId && Number.isFinite(opts.userId)) {
      params.set('user_id', String(opts.userId));
    }
    if (opts?.name) {
      params.set('name', opts.name);
    }
    if (opts?.share_key) {
      params.set('share_key', opts.share_key);
    }
    const qs = params.toString();
    const url = `${API_BASE_URL}/backend/list_staff.php${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, staff: data.staff || [] };
    }
    return { success: false, message: data.message || data.error || 'Failed to load staff list' };
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function createShareKey(staffId: number): Promise<{ success: boolean; share_key?: string; expires_at?: string; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/create_share_key.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ staff_id: staffId }),
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function sendReminder(staffId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/send_reminder.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ staff_id: staffId }),
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function createUser(payload: {
  username: string;
  password: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}): Promise<{ success: boolean; message?: string; user?: any }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/create_user.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

// -----------------------------
// Offer Acceptance
// -----------------------------

export interface OfferAcceptance {
  offer_id: number;
  staff_id: number;
  created_by_user_id: number;
  employee_name: string;
  job_title: string;
  pay_rate: string;
  signature_attachment_id: number;
  signature_data_url?: string;
  accepted_date: string; // YYYY-MM-DD
  accepted_at: string; // timestamp
}

export interface OfferPosition {
  position_id: number;
  position_code: string;
  position_name: string;
  offer_letter_template: string;
  job_description_template: string;
  is_active: number;
}

export interface OfferInitiation {
  initiation_id: number;
  staff_id: number;
  initiated_by_user_id: number;
  employee_name: string;
  job_title: string;
  pay_rate: string;
  position_code?: string | null;
  offer_letter_body?: string | null;
  initiated_at: string;
  updated_at: string;
}

export async function getOfferPositions(): Promise<{ success: boolean; positions?: OfferPosition[]; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/offer_positions_get.php`, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success) return { success: true, positions: data.positions ?? [] };
    return { success: false, message: data.message || 'Failed to load positions' };
  } catch {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function getMyOfferAcceptance(opts?: { staff_id?: number }): Promise<{ success: boolean; accepted?: boolean; offer?: OfferAcceptance | null; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const params = new URLSearchParams();
    if (opts?.staff_id && Number.isFinite(opts.staff_id)) params.set('staff_id', String(opts.staff_id));
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/backend/offer_acceptance_get.php${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, accepted: !!data.accepted, offer: data.offer ?? null };
    }
    return { success: false, message: data.message || 'Failed to load offer acceptance' };
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function acceptMyOffer(payload: {
  signature_data_url: string;
  accepted_date: string;
  jd_read_ack?: boolean;
  hipaa_ack?: boolean;
  abuse_ack?: boolean;
}): Promise<{ success: boolean; message?: string; signature_attachment_id?: number; accepted_date?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/offer_acceptance_submit.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, message: data.message, signature_attachment_id: data.signature_attachment_id, accepted_date: data.accepted_date };
    }
    return { success: false, message: data.message || 'Failed to accept offer' };
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function getMyOfferInitiation(opts?: { staff_id?: number }): Promise<{ success: boolean; initiated?: boolean; offer?: OfferInitiation | null; message?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const params = new URLSearchParams();
    if (opts?.staff_id && Number.isFinite(opts.staff_id)) params.set('staff_id', String(opts.staff_id));
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/backend/offer_initiation_get.php${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function initiateOffer(payload: {
  staff_id?: number;
  employee_name: string;
  first_name?: string;
  last_name?: string;
  job_title: string;
  pay_rate: string;
  position_code?: string;
  offer_letter_body?: string;
  username?: string;
  email?: string;
  send_email?: boolean;
}): Promise<{ success: boolean; message?: string; staff_id?: number; user_created?: boolean; staff_created?: boolean }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const response = await fetch(`${API_BASE_URL}/backend/offer_initiation_submit.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

export async function uploadMySignedOfferLetterPdf(file: Blob, filename: string): Promise<{ success: boolean; message?: string; attachment_id?: number; stored_in?: string }> {
  try {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const form = new globalThis.FormData();
    form.append('pdf', file, filename);

    const response = await fetch(`${API_BASE_URL}/backend/offer_acceptance_upload_signed_offer.php`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? { 'X-Auth-Token': authToken } : {}),
      },
      credentials: 'include',
      body: form,
    });

    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error. Please try again.' };
  }
}

// Get download URL for an attachment
// Note: Token is included as query parameter because direct downloads might not send Authorization headers
export function getAttachmentDownloadUrl(attachmentId: number, opts?: { name?: string; share_key?: string }): string {
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const params = new URLSearchParams();
  params.set('attachment_id', String(attachmentId));
  if (authToken) params.set('token', authToken);
  if (opts?.name) params.set('name', opts.name);
  if (opts?.share_key) params.set('share_key', opts.share_key);
  return `${API_BASE_URL}/backend/download_attachment.php?${params.toString()}`;
}

// Get view URL for an attachment (inline viewing)
// Note: Token is included as query parameter because iframes don't send Authorization headers
// Cache-busting parameter is added to prevent browser from using cached responses with blocking headers
export function getAttachmentViewUrl(attachmentId: number, opts?: { name?: string; share_key?: string }): string {
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  // Add cache-busting timestamp to prevent browser from using cached responses
  const cacheBuster = Date.now();
  const params = new URLSearchParams();
  params.set('attachment_id', String(attachmentId));
  params.set('_t', String(cacheBuster));
  if (authToken) params.set('token', authToken);
  if (opts?.name) params.set('name', opts.name);
  if (opts?.share_key) params.set('share_key', opts.share_key);
  return `${API_BASE_URL}/backend/view_attachment.php?${params.toString()}`;
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

