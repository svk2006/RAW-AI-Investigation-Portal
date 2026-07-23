# RAW AI Investigation Portal — Project Context

## Project

RAW is a prototype AI-assisted cybercrime investigation and digital-forensics platform built for a hackathon.

The system is intended to support:

- Case investigation
- Digital evidence management
- Evidence integrity verification
- Secure evidence storage
- Evidence processing
- Entity extraction
- Timeline reconstruction
- AI-assisted investigation
- Intelligence visualization
- Reports and auditability

This is a prototype under a short development deadline. Prioritize working, demonstrable functionality over unnecessary production complexity.

---

## Technology Stack

Frontend:
- React
- JavaScript
- React Router
- CSS

Backend:
- Zoho Catalyst
- Node.js 24
- Catalyst BasicIO / AdvancedIO functions
- zcatalyst-sdk-node

Storage:
- Zoho Catalyst Data Store
- Zoho Catalyst Stratus

Development:
- VS Code
- Git
- npm
- Catalyst CLI

---

## Repository

Project root:

C:\MyProjects\RAW-AI-Investigation-Portal

React application:

raw-investigation-platform/

Catalyst backend functions:

functions/

Important React files currently include:

- src/App.js
- src/App.css
- src/CaseWorkspace.js

Always inspect the actual repository before making changes.

---

## Zoho Catalyst Stratus

Evidence bucket:

raw-evidence-vault

Current evidence object structure:

cases/{CaseMasterID}/evidence/{UUID}-{sanitizedFileName}

Original evidence stored in Stratus must be treated as immutable.

Do not expose evidence using public URLs unless explicitly required.

---

## Catalyst Data Store

All Catalyst tables also contain standard system columns:

- ROWID
- CREATORID
- CREATEDTIME
- MODIFIEDTIME

### CaseMaster

- CrimeNo — varchar — mandatory
- CaseNo — varchar — mandatory
- CrimeRegisteredDate — date — mandatory
- IncidentFromDate — datetime
- IncidentToDate — datetime
- Latitude — double
- Longitude — double
- BriefFacts — text

### Accused

- CaseMasterID — bigint — mandatory
- AccusedName — varchar — mandatory — PII
- AgeYear — int — PII
- GenderID — varchar — PII
- PersonID — varchar

### Victim

- CaseMasterID — bigint — mandatory
- VictimName — varchar — mandatory — PII
- AgeYear — int — PII
- GenderID — varchar — PII

### Employee

- KGID — varchar — mandatory, unique, PII
- FirstName — varchar — mandatory, PII
- UnitID — bigint
- RankID — bigint
- DesignationID — bigint
- CatalystUserID — varchar — unique

### Evidence

IMPORTANT: The table name is `Evidence`, NOT `EvidenceMaster`.

- CaseMasterID — bigint — mandatory
- EvidenceType — varchar — mandatory
- OriginalFileName — varchar — mandatory
- StorageObjectKey — varchar — mandatory, unique
- SHA256Hash — varchar — mandatory
- UploadedBy — varchar — mandatory
- UploadedAt — datetime — mandatory
- ProcessingStatus — varchar — mandatory
- MimeType — varchar
- FileSize — bigint
- SourceDescription — varchar

### ExtractedEntity

- CaseMasterID — bigint — mandatory
- EvidenceID — bigint — mandatory
- EntityType — varchar — mandatory
- EntityValue — varchar — mandatory
- Confidence — double
- SourceLocation — varchar — mandatory, PII
- Verified — boolean
- CreatedAt — datetime — mandatory

### TimelineEvent

- CaseMasterID — bigint — mandatory
- EvidenceID — bigint
- EventTime — datetime — mandatory
- EventType — varchar — mandatory
- Description — varchar — mandatory
- Latitude — double
- Longitude — double
- Confidence — double
- CreatedByAI — boolean — mandatory

### AIInsight

- CaseMasterID — bigint — mandatory
- EvidenceID — bigint
- InsightType — varchar — mandatory
- Title — varchar — mandatory
- Description — varchar — mandatory
- Confidence — double
- Status — varchar — mandatory
- GeneratedAt — datetime — mandatory
- ReviewedBy — varchar

Do not invent or rename tables or columns.

---

## Current Working Functionality

The following has already been implemented and tested:

- React application runs through Catalyst.
- Dashboard retrieves cases.
- Cases are displayed.
- Open Investigation works.
- Case Workspace displays case information.
- Evidence upload UI works.
- Evidence files are submitted using multipart FormData.
- `evidence_upload` AdvancedIO function works.
- Busboy parses uploads.
- SHA-256 is generated using Node crypto.
- Evidence is stored in Stratus.
- Evidence metadata is inserted into the `Evidence` table.
- Successful evidence registration returns metadata to React.

Current evidence pipeline:

React
→ evidence_upload
→ multipart parsing
→ validation
→ SHA-256
→ Stratus
→ Evidence table
→ React response

Current development upload limit: 25 MB.

---

## Important Technical Rules

React frontend files must NEVER import backend Node modules such as:

- busboy
- crypto
- stream
- zcatalyst-sdk-node

Those belong only in Catalyst backend functions.

`UploadedAt` in Evidence is mandatory.

The current working Catalyst datetime handling uses:

YYYY-MM-DD HH:MM:SS

Do not change working evidence-upload behavior unnecessarily.

Do not modify original evidence after storage.

Derived artifacts must remain separate from original evidence.

SHA-256 represents evidence integrity and must be preserved.

AI-generated information must not be presented as verified evidence.

Do not fabricate AI results, extracted entities, timeline events, or investigation findings.

---

## UI Direction

The interface should look like professional cybercrime / digital-forensics investigation software.

Use:

- near-black
- dark navy
- blue
- electric blue
- cyan for intelligence/AI
- green for integrity/success
- amber for warnings
- red for errors
- readable blue-grey secondary text

Avoid:

- hacker-movie gimmicks
- excessive neon
- unnecessary animation
- excessive gradients
- emojis
- poor contrast

Prioritize usability and readability.

---

## Agent Rules

Read this file before modifying the project.

The user will provide tasks ONE AT A TIME.

Only implement the task explicitly requested.

Do not automatically continue to another feature.

Do not perform unrelated refactoring.

Preserve existing working functionality.

Inspect existing code before modifying it.

Never invent Catalyst tables, columns, bucket names, APIs, credentials, routes, or configuration.

If required information is missing, ask the user.

If something must be configured manually outside VS Code, such as in the Catalyst Console:

1. Tell the user that manual action is required.
2. Give exact step-by-step instructions.
3. Tell the user how to verify it.
4. STOP and wait for confirmation.
5. Continue only after the user confirms completion.

After implementing a requested task:

1. State what was changed.
2. List files created/modified.
3. Mention dependencies added, if any.
4. Give exact testing instructions.
5. State the expected result.
6. STOP and wait for the user to test.

Compilation alone does not prove a feature works.

Do not proceed to the next feature until the current feature has been tested successfully.

The core development rule is:

FULL PROJECT CONTEXT.
ONE TASK AT A TIME.
TEST BEFORE CONTINUING.