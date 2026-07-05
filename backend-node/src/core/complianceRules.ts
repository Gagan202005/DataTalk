/**
 * Deterministic compliance rule engine - PII checking only.
 */

const PII_PATTERNS = [
  'aadhaar','aadhar','uid','biometric','fingerprint','iris',
  'pan_number','pan number','passport','voter_id','voter id',
  'ssn','social security','dob','date_of_birth','date of birth',
  'password','pin','cvv','credit_card','debit_card',
];

export function checkPiiQuery(question: string): Record<string, string> | null {
  const q = question.toLowerCase();
  for (const pattern of PII_PATTERNS) {
    if (q.includes(pattern)) {
      return {
        rule: 'PII_EXPOSURE',
        status: 'blocked',
        message: `Query blocked: This analysis appears to request access to sensitive personal data ('${pattern}'). PII must be anonymised before analysis. Use the Sensitive Column toggle to mask this field first.`,
      };
    }
  }
  return null;
}
