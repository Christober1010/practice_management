import { FormData } from '@/lib/types';

export function isValidSSN(ssn: string): boolean {
  const digits = (ssn || '').replace(/\D/g, '');
  return digits.length === 9;
}

export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  // Remove all non-digit characters and check if it has at least 10 digits
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export function getFieldError(field: keyof FormData, value: any, formData?: FormData): string | null {
  switch (field) {
    case 'ssn':
      if (!value) return null; // Empty is handled by required check
      return isValidSSN(value) ? null : 'SSN must have exactly 9 digits';
    
    case 'email':
      if (!value) return null; // Empty is handled by required check
      return isValidEmail(value) ? null : 'Please enter a valid email address';
    
    case 'cellPhone':
    case 'primaryPhone':
      if (!value) return null; // Empty is handled by required check
      return isValidPhone(value) ? null : 'Please enter a valid phone number';
    
    default:
      return null;
  }
}

export function isFieldInvalid(field: keyof FormData, value: any): boolean {
  switch (field) {
    case 'ssn':
      return value ? !isValidSSN(value) : false;
    
    case 'email':
      return value ? !isValidEmail(value) : false;
    
    case 'cellPhone':
    case 'primaryPhone':
      return value ? !isValidPhone(value) : false;
    
    default:
      return false;
  }
}

