import React, { useState, useRef } from 'react';
import { Shield, ChevronDown, ChevronUp, BookOpen, AlertTriangle, Scale, FileText, Lock, CreditCard, Users, X, Upload, CheckCircle2 } from 'lucide-react';

const COMPLIANCE_GUIDELINES = [
  {
    id: 'irac',
    icon: Scale,
    title: 'IRAC Norms',
    subtitle: 'Income Recognition & Asset Classification',
    color: '#ef4444',
    rules: [
      { label: 'NPA Definition', text: 'A loan account immediately becomes a Non-Performing Asset (NPA) when interest or principal remains overdue for more than 90 consecutive days. Correct classification must happen on a daily basis.' },
      { label: 'SMA-0', text: 'Early warning signal. Represents accounts where principal or interest is overdue between 1 to 30 days.' },
      { label: 'SMA-1', text: 'Represents accounts where principal or interest is overdue between 31 to 60 days. Requires enhanced monitoring.' },
      { label: 'SMA-2', text: 'Critical warning stage (61–90 days past due). Banks are required to report SMA-2 accounts to the Central Repository of Information on Large Credits (CRILC) for aggregate exposures greater than ₹5 Crore.' },
      { label: 'Substandard Asset', text: 'An asset that has remained an NPA for a period less than or equal to 12 months (DPD 91–365 days). Carries a mandatory provisioning requirement of 15% for secured exposures and 25% for unsecured.' },
      { label: 'Doubtful Asset', text: 'An asset that has remained in the substandard category for over 12 months. Provisioning requirements jump significantly, ranging from 25% to 100% depending on the age of the NPA and the realizable value of security.' },
      { label: 'Loss Asset', text: 'An asset identified as a loss by the bank or auditor where no recoverable value remains. It must be fully written off or provided for at 100%.' },
    ],
  },
  {
    id: 'psl',
    icon: Users,
    title: 'PSL Guidelines',
    subtitle: 'Priority Sector Lending',
    color: '#22c55e',
    rules: [
      { label: 'Overall Target', text: 'Mandates that 40% of a bank\'s Adjusted Net Bank Credit (ANBC) or Credit Equivalent Amount of Off-Balance Sheet Exposure (CEOBE) is directed to priority sectors.' },
      { label: 'Agriculture', text: '18% of ANBC must be allocated to agriculture. This encompasses farm credit, agriculture infrastructure, and ancillary activities.' },
      { label: 'Micro Enterprises', text: '7.5% of ANBC must specifically target micro-enterprises to ensure equitable credit distribution among small businesses.' },
      { label: 'Weaker Sections', text: '12% of ANBC is reserved for weaker sections, which includes SC/ST communities, minorities, women self-help groups (SHGs), and persons with disabilities.' },
      { label: 'Education Loans', text: 'Loans eligible under PSL include up to ₹20 lakh for vocational courses and higher studies within India, and up to ₹40 lakh for studies abroad.' },
      { label: 'Shortfall Penalty', text: 'Failure to meet PSL targets requires banks to deposit their exact shortfall amounts into the Rural Infrastructure Development Fund (RIDF) or other specified funds at penalized, below-market interest rates.' },
    ],
  },
  {
    id: 'pmla',
    icon: AlertTriangle,
    title: 'PMLA / AML',
    subtitle: 'Prevention of Money Laundering',
    color: '#f59e0b',
    rules: [
      { label: 'CTR Threshold Requirements', text: 'Every cash transaction aggregating to ₹10 lakh or more (or its equivalent in foreign currency) must be mandatorily reported via a Cash Transaction Report (CTR).' },
      { label: 'STR Filing Obligation', text: 'Suspicious Transaction Reports (STRs) must be filed with the Financial Intelligence Unit (FIU-IND) whenever a transaction exhibits unusual patterns, regardless of the monetary amount.' },
      { label: 'CTR Deadlines', text: 'Consolidated CTRs for a given month must be successfully transmitted to the FIU-IND by the 15th day of the succeeding month.' },
      { label: 'Structuring & Linked Transactions', text: 'Monitoring systems must flag multiple smaller cash transactions by the same individual that purposefully aggregate to ≥₹10 lakh within a single calendar month to evade limits.' },
      { label: 'Cross-Border Wire Transfers', text: 'All cross-border wire transfers exceeding ₹5 lakh demand complete originator and beneficiary information to prevent international money laundering.' },
      { label: 'Document Retention', text: 'All transaction records and identity documentation must be preserved in a retrievable format for a minimum of 5 years following the transaction date.' },
    ],
  },
  {
    id: 'dpdp',
    icon: Lock,
    title: 'DPDP Act 2023',
    subtitle: 'Digital Personal Data Protection',
    color: '#a855f7',
    rules: [
      { label: 'Explicit Consent', text: 'Processing of digital personal data is strictly prohibited without the explicit, free, specific, and informed consent of the Data Principal.' },
      { label: 'PII Protection Standard', text: 'Personally Identifiable Information (PII) including Aadhaar numbers, PAN cards, biometrics, and financial credentials must be heavily masked or anonymized before bulk analysis.' },
      { label: 'Data Minimization', text: 'Organizations must strictly adhere to collecting and processing only the data practically necessary for the unequivocally stated purpose.' },
      { label: 'Right to Erasure', text: 'Data Principals possess the statutory right to request the immediate correction and deletion of their personal data when it is no longer required.' },
      { label: 'Breach Notification', text: 'In the event of a personal data breach, Data Fiduciaries must report the incident to the Data Protection Board of India and the affected users without any undue delay.' },
      { label: 'Cross-Border Transfer Restrictions', text: 'Transfer of personal data outside the geographical boundaries of India is restricted to countries explicitly notified and approved by the Central Government.' },
    ],
  },
  {
    id: 'fair_practices',
    icon: FileText,
    title: 'Fair Practices Code',
    subtitle: 'Ethical Lending Guidelines',
    color: '#3b82f6',
    rules: [
      { label: 'Loan Document Acknowledgement', text: 'Banks are required to provide a written, dated acknowledgement for all submitted loan applications, accompanied by a clear timeline for the processing decision.' },
      { label: 'Interest Rate Transparency', text: 'The exact annualized rate of interest and the comprehensive total cost of credit must be explicitly documented and communicated to the borrower prior to sanctioning.' },
      { label: 'Prepayment Penalty Prohibition', text: 'Banks are prohibited from levying foreclosure charges or prepayment penalties on floating rate term loans sanctioned to individual borrowers for non-business purposes.' },
      { label: 'Ethical Recovery Practices', text: 'Banks must strictly prohibit undue harassment, muscle power, or intimidation for loan recovery. Banks may only employ officially documented and authorized recovery agents.' },
      { label: 'Grievance Redressal System', text: 'Every financial institution must deploy a Board-approved grievance redressal mechanism with established escalation matrices and public nodal officers.' },
      { label: 'Rejection Communication', text: 'If a loan application is rejected, the financial institution must invariably communicate the main reasons for rejection in writing to the applicant.' },
    ],
  },
  {
    id: 'kyc',
    icon: CreditCard,
    title: 'KYC / CDD Norms',
    subtitle: 'Know Your Customer Core Policies',
    color: '#06b6d4',
    rules: [
      { label: 'Risk Categorization matrix', text: 'All onboarded customers must be diligently profiled and categorized into Low, Medium, and High-risk buckets based on occupational and financial risk assessments.' },
      { label: 'Periodic KYC Updation', text: 'Financial profiles require mandatory periodic review and updation: every 2 years for High-Risk, every 8 years for Medium-Risk, and every 10 years for Low-Risk customers.' },
      { label: 'Aadhaar e-KYC Usage', text: 'OTP-based Aadhaar e-KYC is permitted for immediate remote onboarding, but restricts the account to a maximum balance of ₹1 lakh until full biometric KYC is concluded.' },
      { label: 'Beneficial Ownership Identification', text: 'Banks must pierce the corporate veil to identify ultimate beneficial owners (UBOs) holding more than 10% controlling ownership in legal entities or companies.' },
      { label: 'PEP Screening', text: 'Politically Exposed Persons (PEPs) mandate Enhanced Due Diligence (EDD), independent wealth source verification, and explicit senior management approval before account opening.' },
      { label: 'Video Customer Identification', text: 'V-CIP (Video KYC) is a legally recognized alternative to physical KYC, allowing fully paperless onboarding through remote, secure audiovisual interaction with bank officials.' },
    ],
  },
];

const COMPLIANCE_TIPS = [
  "Ask: 'Show me loans with DPD > 60 that are still marked as Standard'",
  "Ask: 'What is the PSL ratio in my portfolio?'",
  "Ask: 'Which cash transactions exceed ₹10 lakh?'",
  "Ask: 'What are the NPA provisioning requirements?'",
  "Ask: 'Show SMA-2 accounts not reported to CRILC'",
  "Ask: 'How to calculate priority sector lending shortfall?'",
];

export default function CompliancePanel({ isActive, onClose, onAskQuestion }) {
  const [expandedId, setExpandedId] = useState(null);
  const [tipIdx, setTipIdx] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const fileInputRef = useRef(null);

  const nextTip = () => setTipIdx((i) => (i + 1) % COMPLIANCE_TIPS.length);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedDocs((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, size: f.size })),
    ]);
    e.target.value = '';
  };

  if (!isActive) return null;

  return (
    <div className="compliance-panel">
      {/* Header */}
      <div className="compliance-panel-header">
        <div className="compliance-panel-header-left">
          <Shield size={14} className="compliance-panel-icon" />
          <span className="compliance-panel-title">SECURITY & COMPLIANCE</span>
          <span className="compliance-panel-live-dot" />
        </div>
        <button className="compliance-panel-close" onClick={onClose} title="Close compliance panel">
          <X size={13} />
        </button>
      </div>

      {/* Quick tip */}
      <div className="compliance-panel-tip" onClick={nextTip}>
        <BookOpen size={11} className="compliance-panel-tip-icon" />
        <span>{COMPLIANCE_TIPS[tipIdx]}</span>
      </div>

      {/* Guideline cards */}
      <div className="compliance-panel-body">
        {COMPLIANCE_GUIDELINES.map((g) => {
          const Icon = g.icon;
          const isExpanded = expandedId === g.id;
          return (
            <div key={g.id} className={`compliance-guideline-card${isExpanded ? ' expanded' : ''}`}>
              <button
                className="compliance-guideline-header"
                onClick={() => setExpandedId(isExpanded ? null : g.id)}
              >
                <div className="compliance-guideline-icon" style={{ background: `${g.color}15`, borderColor: `${g.color}30` }}>
                  <Icon size={13} style={{ color: g.color }} />
                </div>
                <div className="compliance-guideline-info">
                  <div className="compliance-guideline-title">{g.title}</div>
                  <div className="compliance-guideline-subtitle">{g.subtitle}</div>
                </div>
                <div className="compliance-guideline-count" style={{ color: g.color, borderColor: `${g.color}40`, background: `${g.color}10` }}>
                  {g.rules.length}
                </div>
                {isExpanded ? <ChevronUp size={12} className="compliance-chevron" /> : <ChevronDown size={12} className="compliance-chevron" />}
              </button>

              {isExpanded && (
                <div className="compliance-guideline-rules">
                  {g.rules.map((r, i) => (
                    <div key={i} className="compliance-rule-item" style={{ borderLeftColor: g.color }}>
                      <div className="compliance-rule-label">{r.label}</div>
                      <div className="compliance-rule-text">{r.text}</div>
                    </div>
                  ))}
                  <button
                    className="compliance-ask-btn"
                    style={{ color: g.color, borderColor: `${g.color}40`, background: `${g.color}0a` }}
                    onClick={() => {
                      if (onAskQuestion) {
                        onAskQuestion(`Tell me about ${g.title} - ${g.subtitle} compliance requirements`);
                      }
                    }}
                  >
                    <BookOpen size={11} />
                    Ask AI about {g.title}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Upload compliance document */}
        <div className="compliance-upload-section">
          <div className="compliance-upload-header">
            <Upload size={12} className="compliance-upload-icon" />
            <span className="compliance-upload-title">Add Your Own Compliance Docs</span>
          </div>
          <p className="compliance-upload-desc">
            Upload your organization's compliance documentation to ensure all operations stay within your defined bounds.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button className="compliance-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={11} />
            Upload Document
          </button>
          {uploadedDocs.length > 0 && (
            <div className="compliance-uploaded-list">
              {uploadedDocs.map((doc, i) => (
                <div key={i} className="compliance-uploaded-item">
                  <CheckCircle2 size={10} className="compliance-uploaded-check" />
                  <span className="compliance-uploaded-name">{doc.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="compliance-panel-footer">
        <Shield size={10} />
        <span>Regulatory & organizational compliance monitoring</span>
      </div>
    </div>
  );
}
