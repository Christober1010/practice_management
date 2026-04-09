export function formatSSN(value: string): string {
  const numbers = value.replace(/\D/g, '');
  let formatted = '';
  
  if (numbers.length > 0) {
    formatted = numbers.substring(0, 3);
  }
  if (numbers.length > 3) {
    formatted += '-' + numbers.substring(3, 5);
  }
  if (numbers.length > 5) {
    formatted += '-' + numbers.substring(5, 9);
  }
  
  return formatted;
}

