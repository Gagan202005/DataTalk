# Digital Personal Data Protection (DPDP) Act 2023 — Banking Applicability

Source: The Digital Personal Data Protection Act, 2023 (India)

## What Counts as Personal Data

Under the DPDP Act, "personal data" means any data about an individual who is identifiable:
- Name, address, phone number, email
- Aadhaar number, PAN, Passport number, Voter ID
- Bank account number, credit/debit card details
- Biometric data (fingerprint, iris scan, facial recognition)
- Health/medical records
- Sexual orientation, religious beliefs, political views (Sensitive Personal Data)

## Data Fiduciary Obligations (Banks)

Banks are "Data Fiduciaries" under DPDP and must:

1. **Obtain consent** before collecting or processing personal data
2. **Specify purpose** — data can only be used for the stated purpose
3. **Data minimisation** — collect only what is necessary
4. **Storage limitation** — do not retain data beyond the necessary period
5. **Accuracy** — ensure data is accurate and updated
6. **Security safeguards** — implement appropriate technical and organisational measures
7. **Grievance redressal** — appoint a Data Protection Officer (DPO) and provide a mechanism for complaints

## Aadhaar-Specific Rules

The Aadhaar Act 2016 restricts use of Aadhaar numbers:
- Banks may collect Aadhaar for eKYC purposes only with explicit consent
- Aadhaar numbers must NOT be stored in plain text — must be tokenised or hashed
- Aadhaar must NOT be displayed in full in any report, statement, or screen
- Using Aadhaar data for purposes other than authentication is prohibited

## PAN-Specific Rules

- PAN is mandatory for transactions above Rs.50,000 (cash) and Rs.2.5 lakh (certain deposits)
- PAN must not be exposed in analytics output or reports visible to unauthorised personnel
- Sharing PAN data with third parties requires explicit customer consent unless mandated by law

## Penalties for Violation

| Violation | Penalty |
|---|---|
| Failure to take security safeguards | Up to Rs.250 crore |
| Failure to notify Data Protection Board of breach | Up to Rs.200 crore |
| Non-fulfilment of obligations for children's data | Up to Rs.200 crore |
| Breach of any provision | Up to Rs.50 crore |

## Implications for Data Analysis

When running analytics on banking data:
- Aadhaar, PAN, biometric fields must be masked or excluded before analysis
- Customer names combined with financial data should be treated as personal data
- Aggregated/anonymised data (no individual identifiability) is generally permissible
- Results containing individual-level PII must not be shared or exported without consent
- Any AI model trained on customer data must have documented consent basis
