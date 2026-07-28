# RAW Investigation Intelligence Platform

> AI-Assisted Digital Investigation, Evidence Intelligence and Case Analysis Platform

The **RAW Investigation Intelligence Platform** is a prototype investigation intelligence system designed to help law-enforcement investigators securely manage digital evidence, extract intelligence, reconstruct timelines, identify relationships between entities, and interact with case evidence through an AI-assisted investigation copilot.

The platform combines secure case management, digital evidence processing, OCR, AI-assisted analysis, intelligence graph visualisation, timeline reconstruction, grounded conversational AI, role-based access control, and professional investigation reporting in a single investigation workspace.

---

## Live Prototype

The application is deployed using Zoho Catalyst.

| Field | Details |
|---|---|
| Application | RAW Investigation Intelligence Platform |
| Environment | Zoho Catalyst Development |
| Platform | Web |
| Deployed URL | [Click Here to Access the Portal](https://raw-investigation-platform-60079111719.development.catalystserverless.in/__catalyst/auth/login) |
| Demo Username / Email | `inspector.raw@gmail.com` |
| Demo Password | `Inspector@2026` |
| Demo Role | Investigator |
| Demo Officer | A. Kumar |
| Demo KGID | POL100821 |

### Judge Login

1. Open the deployed application URL.
2. Enter the demo username/email.
3. Enter the demo password.
4. Sign in.
5. The application will open the Investigator Dashboard.
6. Select **Open Investigation** to enter the investigation workspace.

> **Demo Notice:** The credentials above are intended only for prototype/judging access. Do not place personal or production credentials in this repository.

---

# Problem Statement

Modern criminal and cybercrime investigations generate large volumes of heterogeneous digital evidence including:

- Images
- PDF documents
- Text documents
- Email information
- Device-related evidence
- Extracted entities
- Communication identifiers
- IP addresses
- Domain information
- Locations
- Transaction references

Investigators often need to manually correlate information distributed across these evidence sources.

The RAW Investigation Intelligence Platform provides a unified intelligence workspace where evidence can be collected, processed, analysed, correlated and reviewed.

---

# Core Investigation Workflow

```text
Authenticated Investigator
        │
        ▼
Investigator Dashboard
        │
        ▼
Assigned Investigation
        │
        ▼
Case Workspace
        │
        ├── Evidence Vault
        │       │
        │       ├── Upload Evidence
        │       ├── Retrieve Evidence
        │       ├── Preview Evidence
        │       ├── Download Original
        │       └── Evidence Integrity Metadata
        │
        ▼
Evidence Processing
        │
        ├── Text Extraction
        ├── PDF Extraction
        ├── Zia OCR
        └── Gemini AI Analysis
        │
        ▼
Extracted Intelligence
        │
        ├── Entities
        ├── AI Findings
        ├── Timeline Events
        └── Relationships
        │
        ├───────────────┐
        ▼               ▼
Intelligence Graph    Timeline
        │
        ▼
RAW Copilot
        │
        ▼
Investigation Report
        │
        ▼
Professional PDF Export
```

---

# Major Features

## 1. Secure Investigator Authentication

The platform uses **Zoho Catalyst Hosted Authentication** for user authentication.

Authenticated Catalyst users are mapped to operational employee records inside the investigation platform.

```text
Catalyst User
      │
      ▼
getCurrentUser()
      │
      ▼
Catalyst User ID
      │
      ▼
Employee Mapping
      │
      ▼
Designation
      │
      ▼
Operational Role
```

Example:

```text
Officer: A. Kumar
KGID: POL100821
Role: INVESTIGATOR
```

---

## 2. Role-Based Access Control

The backend implements operational RBAC.

Supported role architecture:

- Investigator
- Supervisor
- Administrator

Permissions include:

- View Case
- View Evidence
- Upload Evidence
- Process Evidence
- Download Evidence
- Run AI Analysis
- View Timeline
- View Intelligence Graph
- Use RAW Copilot
- Export Copilot
- View Reports
- View Audit Trail
- Manage Users

Case-level authorisation is additionally enforced through case assignments.

This prevents an investigator from accessing investigations that have not been assigned to them.

---

## 3. Investigator Dashboard

The Investigator Dashboard provides an operational overview of assigned investigations.

Dashboard information includes:

- Active Cases
- Evidence Items
- AI Findings
- Pending Review
- Assigned investigations
- Case identifiers
- Crime identifiers
- Incident information
- Investigation status

The interface uses a professional light intelligence-workspace design with a dark RAW command header.

---

## 4. Case Workspace

Each investigation opens into a dedicated Case Workspace.

The workspace acts as the primary operational environment for the investigator.

It provides access to:

- Case information
- Evidence Vault
- AI-assisted analysis
- Timeline reconstruction
- Intelligence Graph
- RAW Copilot
- Investigation Reports

---

## 5. Digital Evidence Vault

The Evidence Vault provides structured management of digital evidence associated with an investigation.

Supported evidence information includes:

- Filename
- Evidence type
- MIME type
- File size
- Upload timestamp
- Source
- Processing status
- Evidence ID
- SHA-256 integrity hash

Evidence is presented through structured forensic evidence cards rather than raw database metadata.

### Evidence Integrity

SHA-256 hashes are retained to support evidence integrity verification.

```text
Evidence
   │
   ├── Original File
   ├── Metadata
   ├── Evidence ID
   └── SHA-256 Hash
```

---

## 6. Secure Evidence Storage

Uploaded evidence is stored using **Zoho Catalyst Stratus**.

The application separates:

```text
Evidence Binary
      │
      ▼
Catalyst Stratus

Evidence Metadata
      │
      ▼
Catalyst Data Store
```

This allows evidence files and structured investigation metadata to be managed independently.

---

## 7. Evidence Processing

Evidence can pass through multiple processing mechanisms depending on its format.

### Text Evidence

Text files can be directly parsed for analysis.

### PDF Evidence

Textual content can be extracted from PDF evidence.

### Image Evidence

Image evidence can be processed using **Zoho Zia OCR** to extract machine-readable text.

```text
Image Evidence
      │
      ▼
Zia OCR
      │
      ▼
Extracted Text
      │
      ▼
AI Analysis
```

---

## 8. Gemini AI-Assisted Analysis

The platform integrates **Google Gemini** for contextual evidence analysis.

AI processing can identify useful investigative information such as:

- Persons
- Email addresses
- Phone numbers
- IP addresses
- Domains
- URLs
- Locations
- Transaction references
- Relevant observations
- Potential relationships

AI-generated findings remain investigator-assistance features rather than automatically becoming authoritative conclusions.

---

## 9. Human Review of AI Findings

AI-assisted findings support investigator review states such as:

- Pending Review
- Accepted
- Rejected

This preserves a human-in-the-loop investigation workflow.

```text
AI Finding
    │
    ▼
Pending Review
    │
    ├── Accepted
    │
    └── Rejected
```

---

## 10. Intelligence Graph

The Intelligence Graph provides visual relationship analysis between case information, evidence and extracted entities.

Supported node categories include:

- Case
- Evidence
- Person
- Email
- Phone
- IP Address
- Domain
- URL
- Location
- Transaction Reference

The graph uses D3-based interactive visualisation.

### Graph Capabilities

- SVG icon-based entity nodes
- Entity-specific colours
- Case/evidence/entity hierarchy
- Search
- Entity filters
- Zoom
- Pan
- Node dragging
- Fit View
- Fullscreen investigation mode
- Relationship highlighting
- Node focus mode
- Entity detail panel
- Verification indicators
- Source evidence navigation

Selecting an entity highlights its immediate investigative relationships while visually reducing unrelated nodes.

---

## 11. Timeline Reconstruction

Extracted events can be presented through an investigation timeline.

Timeline events can contain:

- Event title
- Timestamp
- Description
- Associated evidence
- Source reference

This helps investigators reconstruct sequences of events from distributed evidence.

---

# RAW Copilot

RAW Copilot is the platform's grounded AI investigation assistant.

Instead of functioning as a general-purpose chatbot, RAW Copilot operates using investigation context.

```text
Investigator Question
        │
        ▼
RAW Copilot
        │
        ▼
Case + Evidence Context
        │
        ▼
Grounded AI Response
        │
        ▼
Evidence Citations
```

## Copilot Capabilities

- Investigation-specific questions
- Evidence-grounded responses
- Source evidence citations
- Persisted conversations
- New conversation workflow
- Evidence navigation
- Voice input
- Text-to-Speech
- English support
- Kannada support
- PDF transcript export

---

# Investigation Reports

The platform generates professional investigation reports directly from structured case data.

The report generator is programmatic and does **not** capture the application screen.

Reports contain sections such as:

1. Case Summary
2. Evidence Inventory
3. Extracted Intelligence Entities
4. Reconstructed Timeline
5. AI-Assisted Findings
6. Investigative Summary
7. AI Usage Disclaimer

Reports use a professional white-paper forensic document design suitable for review and demonstration.

---

# Technology Stack

## Frontend

- React
- React Router
- JavaScript
- CSS
- D3.js
- jsPDF
- jsPDF-AutoTable
- Web Speech API
- SpeechSynthesis API

## Backend

- Node.js
- Zoho Catalyst Advanced I/O Functions

## Cloud Platform

- Zoho Catalyst

## Database

- Zoho Catalyst Data Store

## Evidence Storage

- Zoho Catalyst Stratus

## OCR

- Zoho Zia OCR

## Artificial Intelligence

- Google Gemini

## Authentication

- Zoho Catalyst Hosted Authentication
- Catalyst Web SDK

---

# High-Level Architecture

```text
┌───────────────────────────────────────────────┐
│                 React Client                  │
│                                               │
│ Dashboard                                     │
│ Case Workspace                                │
│ Evidence Vault                                │
│ Timeline                                      │
│ Intelligence Graph                            │
│ RAW Copilot                                   │
│ Reports                                       │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│          Zoho Catalyst Functions              │
│                                               │
│ raw_investigation_platform_function           │
│ evidence_upload                               │
│ evidence_retrieval                            │
│ evidence_processing                           │
│ raw_copilot                                   │
└───────────┬───────────────────────┬───────────┘
            │                       │
            ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│ Catalyst Data Store │   │ Catalyst Stratus    │
│                     │   │                     │
│ Cases               │   │ Original Evidence   │
│ Employees           │   │ Files               │
│ Assignments         │   │                     │
│ Evidence Metadata   │   └─────────────────────┘
│ AI Findings         │
│ Timeline            │
│ Copilot History     │
│ Audit Information   │
└──────────┬──────────┘
           │
           ├───────────────┐
           ▼               ▼
     ┌───────────┐   ┌───────────┐
     │ Zia OCR   │   │  Gemini   │
     └───────────┘   └───────────┘
```

---

# Backend Functions

The application contains the following primary Catalyst functions:

| Function | Responsibility |
|---|---|
| `raw_investigation_platform_function` | Case, profile and primary investigation operations |
| `evidence_upload` | Evidence ingestion and Stratus upload |
| `evidence_retrieval` | Secure evidence metadata retrieval |
| `evidence_processing` | Evidence processing, download and AI analysis |
| `raw_copilot` | Investigation Copilot and conversation operations |

---

# Security Architecture

Security controls implemented in the prototype include:

### Authentication

Catalyst Hosted Authentication validates the user session.

### Employee Mapping

The authenticated Catalyst user ID is mapped to an Employee record.

### Role-Based Access Control

Operational permissions are derived from the employee designation.

### Case-Level Authorisation

CaseAssignment restricts investigators to assigned investigations.

### Evidence-Level Protection

Evidence operations perform authorisation before protected evidence access.

### AI Request Protection

Unauthorised users are blocked before AI analysis requests are executed.

### Evidence Integrity

SHA-256 hashes provide evidence-integrity metadata.

### Auditability

Security-relevant actions can be represented through the platform's audit workflow.

---

# Project Structure

```text
RAW-AI-Investigation-Portal/
│
├── functions/
│   ├── raw_investigation_platform_function/
│   ├── evidence_upload/
│   ├── evidence_retrieval/
│   ├── evidence_processing/
│   └── raw_copilot/
│
├── raw-investigation-platform/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── CaseWorkspace.js
│   │   ├── IntelligenceGraph.js
│   │   ├── catalystAuth.js
│   │   └── reportPdfGenerator.js
│   │
│   └── package.json
│
├── catalyst.json
└── README.md
```

---

# Local Development

## Prerequisites

Install:

- Node.js
- npm
- Zoho Catalyst CLI

Install Catalyst CLI:

```bash
npm install -g zcatalyst-cli
```

Authenticate:

```bash
catalyst login
```

Install frontend dependencies:

```bash
cd raw-investigation-platform
npm install
```

Return to the Catalyst project root and start the development environment:

```bash
catalyst serve
```

---

# Production Build

From the React client directory:

```bash
npm run build
```

A successful build should report:

```text
Compiled successfully.
```

---

# Deployment

Deploy the complete Catalyst project:

```bash
catalyst deploy
```

For frontend-only updates:

```bash
catalyst deploy --only client
```

For a specific backend function:

```bash
catalyst deploy --only functions:<FUNCTION_NAME>
```

---

# Environment Configuration

Sensitive values such as API keys must **never be committed directly to the repository**.

Example:

```text
GEMINI_API_KEY=<CONFIGURED_SECURELY>
```

The Gemini API key should be configured through the appropriate Catalyst environment/function configuration.

---

# Demo Workflow for Judges

For a complete prototype demonstration:

1. Sign in using the provided demo credentials.
2. View the Investigator Dashboard.
3. Open the assigned investigation.
4. Inspect the Case Workspace.
5. Open the Evidence Vault.
6. Preview existing evidence.
7. Upload digital evidence.
8. Process evidence / run OCR where applicable.
9. Run AI-assisted analysis.
10. Review extracted intelligence.
11. Accept or reject an AI finding.
12. Open the reconstructed Timeline.
13. Open the Intelligence Graph.
14. Select entities to explore relationships.
15. Navigate from an entity to its source evidence.
16. Open RAW Copilot.
17. Ask a case-specific question.
18. Inspect grounded evidence references.
19. Test voice input / TTS.
20. Open Reports.
21. Export the professional investigation PDF.
22. Sign out.

---

# Prototype Scope

This repository contains a **prototype / hackathon implementation**.

Some workflows, datasets and investigative scenarios may use synthetic demonstration data and should not be interpreted as real law-enforcement records.

AI-generated information is intended to assist investigation workflows and should remain subject to human verification.

---

# Future Scope

Potential future extensions include:

- Commander / Higher Official Intelligence Dashboard
- District-wise crime intelligence
- Karnataka crime intelligence map
- Geographic hotspot analysis
- Crime trend visualisation
- Investigation workload analytics
- Cross-case intelligence correlation
- Advanced graph analytics
- Threat and severity scoring
- Command alerts
- Investigation performance analytics
- Enhanced audit and compliance controls

---

# Disclaimer

The RAW Investigation Intelligence Platform is a prototype developed for technical demonstration and evaluation.

The application does not represent an official production deployment of any government or law-enforcement organisation.

AI-assisted findings must be independently reviewed and verified by authorised investigators before being used for investigative or legal decision-making.
