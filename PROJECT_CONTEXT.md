# RAW AI Investigation Portal — Project Context

## 1. Purpose

This document is the persistent engineering context for AI coding agents working on the RAW AI Investigation Portal.

READ THIS FILE COMPLETELY BEFORE MODIFYING THE PROJECT.

The CURRENT REPOSITORY SOURCE CODE is authoritative for implementation details.

This document defines:
- project purpose
- architecture
- Catalyst resources
- database schema
- completed functionality
- forensic constraints
- development workflow
- current development checkpoint

Development is performed ONE FEATURE AT A TIME.

Do not rebuild working functionality merely because you would implement it differently.

If something requires developer/manual action, provide exact instructions and STOP rather than guessing.

---

# 2. Project

Project Name:

RAW AI Investigation Portal

Purpose:

A prototype digital investigation platform for cybercrime investigation.

The system is intended to help investigators:

- manage investigation cases
- securely ingest digital evidence
- preserve evidence integrity
- process evidence
- extract investigative entities
- reconstruct timelines
- correlate entities across evidence
- visualize investigative relationships
- eventually generate AI-assisted investigative insights

The system must preserve evidence provenance and clearly distinguish deterministic extraction from AI-generated interpretation.

---

# 3. Development Environment

OS:

Windows

Project root:

C:\MyProjects\RAW-AI-Investigation-Portal

React application:

C:\MyProjects\RAW-AI-Investigation-Portal\raw-investigation-platform

Catalyst functions:

C:\MyProjects\RAW-AI-Investigation-Portal\functions

Local development:

catalyst serve

Generated Catalyst build directory:

C:\MyProjects\RAW-AI-Investigation-Portal\.build

IMPORTANT:

.build is generated output.

Do not treat .build as source code.

Actual backend source lives under:

functions/

If .build becomes locked, stop Node/Catalyst processes and allow Catalyst to regenerate it.

---

# 4. Technology Stack

Frontend:
- React
- JavaScript
- CSS
- React Router where currently used

Backend:
- Zoho Catalyst
- Node.js
- Catalyst AdvancedIO functions
- zcatalyst-sdk-node

Database:
- Zoho Catalyst Data Store

Object Storage:
- Zoho Catalyst Stratus

Version Control:
- Git

Do not introduce unnecessary frameworks or dependencies.

---

# 5. UI Direction

RAW uses a professional dark digital-forensics / cyber-investigation interface.

Design language:

- near-black / dark navy backgrounds
- dark blue panels
- restrained blue/cyan accents
- high readability
- professional investigation dashboard
- clear information hierarchy
- compact technical presentation

Avoid:

- excessive neon
- fake hacker-terminal aesthetics
- unnecessary animation
- clutter
- excessive gradients
- effects that reduce usability

Preserve the existing visual system unless explicitly instructed otherwise.

---

# 6. Catalyst Stratus

Evidence bucket:

raw-evidence-vault

Purpose:

Stores ORIGINAL uploaded evidence.

Original evidence must be treated as immutable after successful registration.

Frontend must never receive arbitrary Stratus access.

Frontend identifies evidence using Evidence ROWID.

Backend resolves StorageObjectKey from the trusted Evidence record.

Do not expose public evidence URLs.

---

# 7. Data Store Schema

Do NOT rename tables or columns.

Do NOT modify schema unless explicitly instructed.

Catalyst also provides system fields such as:

ROWID
CREATORID
CREATEDTIME
MODIFIEDTIME

---

## 7.1 CaseMaster

Columns:

CrimeNo — varchar — mandatory
CaseNo — varchar — mandatory
CrimeRegisteredDate — date — mandatory
IncidentFromDate — datetime
IncidentToDate — datetime
Latitude — double
Longitude — double
BriefFacts — text

Current development case:

CaseNo:
CASE-RAW-001

Known ROWID:

48911000000025240

Development/testing uses synthetic case information.

---

## 7.2 Accused

Columns:

CaseMasterID — bigint — mandatory
AccusedName — varchar — mandatory
AgeYear — int
GenderID — varchar
PersonID — varchar

---

## 7.3 Victim

Columns:

CaseMasterID — bigint — mandatory
VictimName — varchar — mandatory
AgeYear — int
GenderID — varchar

---

## 7.4 Employee

Columns:

KGID — varchar — unique, mandatory
FirstName — varchar — mandatory
UnitID — bigint
RankID — bigint
DesignationID — bigint
CatalystUserID — varchar — unique

---

## 7.5 Evidence

IMPORTANT:

Table name is:

Evidence

NOT EvidenceMaster.

Columns:

CaseMasterID — bigint — mandatory
EvidenceType — varchar — mandatory
OriginalFileName — varchar — mandatory
StorageObjectKey — varchar — unique, mandatory
SHA256Hash — varchar — mandatory
UploadedBy — varchar — mandatory
UploadedAt — datetime — mandatory
ProcessingStatus — varchar — mandatory
MimeType — varchar
FileSize — bigint
SourceDescription — varchar

Original evidence resides in Stratus.

Evidence stores registration/forensic metadata.

Current processing states include:

UPLOADED
PROCESSING
PROCESSED
FAILED

---

## 7.6 ExtractedEntity

Columns:

CaseMasterID — bigint — mandatory
EvidenceID — bigint — mandatory
EntityType — varchar — mandatory
EntityValue — varchar — mandatory
Confidence — double
SourceLocation — varchar — mandatory
Verified — boolean
CreatedAt — datetime — mandatory

Current deterministic entity types:

EMAIL
IP_ADDRESS
URL
DOMAIN
PHONE
TRANSACTION_REFERENCE

Automatically extracted entities:

Verified = false

Current deterministic confidence convention:

EMAIL = 0.99
IP_ADDRESS = 0.99
URL = 0.98
DOMAIN = 0.95
PHONE = 0.90
TRANSACTION_REFERENCE = 0.97

These values represent pattern-match confidence, NOT AI confidence.

Entity extraction is deduplicated per evidence.

Repeated processing must not continuously create duplicate EntityType + EntityValue records for the same EvidenceID.

---

## 7.7 TimelineEvent

Columns:

CaseMasterID — bigint — mandatory
EvidenceID — bigint
EventTime — datetime — mandatory
EventType — varchar — mandatory
Description — varchar — mandatory
Latitude — double
Longitude — double
Confidence — double
CreatedByAI — boolean — mandatory

Current timeline extraction is deterministic.

Events are generated from explicit timestamps in supported evidence.

Rule-generated events:

CreatedByAI = false

Timeline extraction is deduplicated.

Repeated processing must not continuously create duplicate TimelineEvent records.

---

## 7.8 AIInsight

Columns:

CaseMasterID — bigint — mandatory
EvidenceID — bigint
InsightType — varchar — mandatory
Title — varchar — mandatory
Description — varchar — mandatory
Confidence — double
Status — varchar — mandatory
GeneratedAt — datetime — mandatory
ReviewedBy — varchar

AIInsight is reserved for future AI-assisted investigative analysis.

Do not fabricate AIInsight rows merely to populate the UI.

---

# 8. Existing Backend

Inspect the actual functions directory before making assumptions.

Known functionality includes:

- case retrieval
- evidence upload
- evidence retrieval
- evidence processing

Evidence processing has been extended incrementally rather than creating a new function for every derived feature.

Do not assume endpoint signatures.

READ THE CURRENT SOURCE.

---

# 9. Evidence Upload Pipeline

Working flow:

React
→ evidence_upload
→ multipart parsing
→ validation
→ SHA-256
→ Stratus upload
→ Evidence metadata insertion
→ response

Evidence should be uploaded through RAW rather than manually creating Evidence records.

Original evidence goes to:

raw-evidence-vault

SHA-256 is stored in:

Evidence.SHA256Hash

Original evidence must remain unchanged.

---

# 10. Upload Rollback Safety

Rollback protection is implemented.

Failure scenario handled:

Stratus upload succeeds
→ Data Store metadata insertion fails
→ potential orphaned object

Current behavior:

If the current request creates a new Stratus object and metadata registration subsequently fails, the backend attempts to delete ONLY the object created by that request.

Never delete unrelated/existing evidence.

Do not weaken this behavior.

---

# 11. Persistent Evidence Retrieval

Evidence retrieval is working.

Evidence survives:

- browser refresh
- reopening investigation
- navigation

Backend responses have been normalized for frontend consumption.

Avoid exposing Catalyst-specific response wrappers unnecessarily to React.

---

# 12. Evidence Detail View

Evidence cards can be opened.

Current metadata includes:

- Evidence ROWID
- filename
- CaseMasterID
- EvidenceType
- MimeType
- FileSize
- UploadedBy
- UploadedAt
- ProcessingStatus
- SourceDescription
- SHA-256
- StorageObjectKey

SHA-256 is displayed fully and can be copied.

StorageObjectKey is metadata only.

No public Stratus URL is exposed.

---

# 13. Evidence Processing

Plain-text evidence processing works.

Flow:

Evidence ROWID
→ backend retrieves trusted Evidence record
→ resolves StorageObjectKey
→ retrieves original Stratus object
→ validates supported type
→ decodes actual UTF-8 content
→ performs deterministic extraction
→ persists derived intelligence
→ returns result

Frontend must NOT provide arbitrary StorageObjectKey.

Unsupported formats must fail gracefully.

Processing failure must never modify/delete original evidence.

---

# 14. Extracted Content

Actual text extracted from stored plain-text evidence can be displayed in Evidence Detail View.

Do not fabricate extracted content.

---

# 15. Deterministic Entity Extraction

Current supported types:

EMAIL
IP_ADDRESS
URL
DOMAIN
PHONE
TRANSACTION_REFERENCE

Extraction is deterministic/pattern-based.

No LLM is required for these entities.

IPv4 values are validated.

Normalization is conservative.

Every persisted entity retains:

CaseMasterID
EvidenceID
SourceLocation

Repeated processing is idempotent.

---

# 16. Timeline Reconstruction

Text evidence can generate deterministic timeline events from explicit timestamps.

Current synthetic format includes:

YYYY-MM-DD HH:MM:SS

Events are persisted in:

TimelineEvent

Events retain EvidenceID provenance.

Repeated processing does not duplicate timeline events.

Timeline UI retrieves persisted events and orders them chronologically.

Never invent missing dates/times.

---

# 17. Cross-Evidence Correlation

Cross-evidence correlation is implemented and manually tested.

Source:

Evidence
+
ExtractedEntity

Rule:

The same normalized EntityType + EntityValue appearing in TWO OR MORE DISTINCT EvidenceID values within the SAME CaseMaster constitutes a cross-evidence correlation.

Example:

phishing_email.txt
→ 203.0.113.42

access_log.txt
→ 203.0.113.42

This means the same observable appears in both evidence items.

It does NOT automatically establish:

- identity
- ownership
- attribution
- guilt
- causation

Do not make unsupported conclusions.

No separate correlation table is currently required.

Case isolation is mandatory.

---

# 18. Intelligence Graph

TASK 7B — Interactive Intelligence Graph UI is COMPLETE and manually tested.

The Intelligence Graph is currently working correctly.

It uses actual persisted Evidence and ExtractedEntity data from the existing
cross-evidence correlation pipeline.

The graph provides an interactive node-link visualization of investigation
relationships.

The current graph implementation is considered part of the WORKING BASELINE.

DO NOT redesign, rewrite, replace, or refactor the Intelligence Graph unless
the developer explicitly requests a graph-related change or reports a verified
bug.

DO NOT replace the existing graph library merely because another library is
preferred.

The working correlation backend must also remain unchanged unless a verified
backend defect is identified.

Graph relationships represent observable evidence relationships only.

A shared entity across evidence does NOT automatically imply:

- identity
- ownership
- attribution
- causation
- guilt
- common attacker

Preserve this distinction.

---

# 19. Intelligence Graph Status

The previous visual problems with Intelligence Graph v1 have been resolved.

The interactive graph is now working satisfactorily and has been manually
tested by the developer.

Treat the current implementation as stable.

Do not spend development time improving the graph unless explicitly requested.

---
# 20. Synthetic Test Evidence

Development uses synthetic evidence.

Known test observables:

attacker@synthetic-example.test

203.0.113.42

TXN-784291

secure-login.synthetic-example.test

Known test files include:

phishing_email.txt
access_log.txt

Files deliberately share observables for cross-evidence correlation testing.

Do not introduce real personal/criminal data for development.

---

# 21. Forensic Engineering Rules

## Original evidence

Never modify original evidence after successful registration.

## Integrity

Do not alter stored SHA-256 values.

## Provenance

Derived intelligence must remain traceable to source EvidenceID.

## AI distinction

Deterministic extraction must not be presented as AI-generated.

Rule-based TimelineEvent:

CreatedByAI = false

Pattern-extracted entity:

Verified = false

## No fabrication

Never fabricate:

- evidence
- extracted content
- entities
- timestamps
- correlations
- investigative conclusions

## Case isolation

All case-specific operations must remain scoped to CaseMasterID.

## Storage security

Do not expose arbitrary/public Stratus access.

---

# 22. Frontend / Backend Separation

React must contain browser-compatible code only.

Never import backend Node packages into React such as:

zcatalyst-sdk-node
crypto
stream
busboy

Catalyst SDK/server logic belongs in backend functions.

---

# 23. Catalyst Response Handling

Catalyst function/local responses may involve wrappers depending on runtime/function type.

Current working code already handles required formats.

Inspect before changing response parsing.

Prefer normalized application JSON from backend functions.

---

# 24. Generated .build Directory

Catalyst generates:

.build

Do NOT manually develop against .build.

Source changes belong in:

functions/

and:

raw-investigation-platform/src/

If Catalyst reports:

unable to cleanup the .build directory

it may be caused by Node/Catalyst processes locking generated files.

Stop the relevant process before deleting/regenerating .build.

Never confuse:

.build/functions/

with the real:

functions/

directory.

---

# 25. Manual-Action Protocol

If a task requires something the coding agent cannot safely perform, including:

- initializing a Catalyst function
- Catalyst Console changes
- Data Store schema changes
- Stratus resource changes
- authentication configuration
- secrets
- deployment configuration requiring developer input

DO NOT GUESS.

Respond:

MANUAL ACTION REQUIRED

Then provide:

1. Exact action
2. Exact command if applicable
3. Resource/function name
4. Function type/runtime if applicable
5. Console location if applicable
6. Exact options/values
7. Verification procedure

Then STOP.

Example:

catalyst functions:add

A newly created function may require restarting:

catalyst serve

---

# 26. Development Workflow

STRICTLY ONE FEATURE/FIX AT A TIME.

For every task:

1. Read PROJECT_CONTEXT.md completely.
2. Inspect current repository state.
3. Inspect relevant existing source.
4. Implement ONLY the requested task.
5. Preserve working functionality.
6. Avoid unrelated refactoring.
7. Avoid unnecessary dependencies.
8. Compile/check syntax.
9. Report what changed.
10. Give manual testing instructions.
11. STOP.

Developer manually tests each task before proceeding.

Do not automatically continue to another roadmap feature.

---

# 27. Git Safety

Before making significant changes inspect:

git status

and when useful:

git diff

The repository may contain work produced by a previous coding-agent session.

DO NOT discard uncommitted changes merely because their origin is unknown.

Determine what they do first.

Do not run destructive Git commands unless explicitly instructed.

Do not reset working code without developer approval.

---


# 28. Completed and Tested Baseline

The following functionality has been built and manually tested:

1. Case retrieval
2. Case Workspace
3. Evidence upload
4. SHA-256 evidence integrity hashing
5. Stratus evidence storage
6. Evidence metadata persistence
7. Upload rollback safety
8. Persistent evidence retrieval
9. Evidence Detail View
10. Plain-text evidence processing
11. Extracted text display
12. Deterministic entity extraction
13. ExtractedEntity persistence
14. Entity deduplication/idempotent processing
15. Deterministic timeline extraction
16. TimelineEvent persistence
17. Timeline deduplication
18. Persistent Timeline UI
19. Cross-evidence entity correlation
20. Intelligence Graph backend/data flow
21. Interactive Intelligence Graph UI

The Interactive Intelligence Graph is COMPLETE and working.

Do not rebuild any of these features unless fixing a verified defect.

---

# 29. Current Development Checkpoint

TASK 7B — Interactive Intelligence Graph UI

STATUS:

COMPLETE
MANUALLY TESTED
WORKING

The project is ready to proceed to the NEXT development task.

However, the next task must NOT be inferred from the roadmap.

Wait for an explicit task prompt before implementing anything.

The current Intelligence Graph and correlation implementation are now part of
the stable project baseline.
---

# 30. Future Roadmap

Potential later work:

- richer document processing
- PDF extraction
- image metadata/OCR
- CSV/log processors
- audio/video processing
- richer entity extraction
- investigator verification
- AI-assisted insights
- AIInsight persistence/review
- case-level intelligence synthesis
- reporting
- auditability
- investigation Copilot

This is roadmap context only.

Do NOT implement any of it without an explicit task.

---

# 31. Core Rule for Coding Agents

When uncertain:

INSPECT FIRST.

Repository source is authoritative for implementation details.

Do not guess Catalyst APIs.

Do not silently rewrite working architecture.

Do not fabricate data.

Do not implement future features.

Do not discard previous-agent work.

If developer action is required, provide exact instructions and STOP.

Preserve the current working baseline.