'use strict';

const { Readable } = require('stream');
const catalyst = require('zcatalyst-sdk-node');

const BUCKET_NAME = 'raw-evidence-vault';
const SUPPORTED_MIME_TYPES = new Set(['text/plain']);

module.exports = async (req, res) => {
  let evidenceTable;
  let evidenceRow;
  let processingStarted = false;

  try {
    const app = catalyst.initialize(req);
    const datastore = app.datastore();
    evidenceTable = datastore.table('Evidence');

    if (req.method === 'GET') {
      const requestUrl = req.url || '';
      const parsedUrl = new URL(requestUrl, 'http://localhost');
      const evidenceId = String(
        parsedUrl.searchParams.get('evidenceId') || ''
      ).trim();
      const caseId = String(
        parsedUrl.searchParams.get('caseId') || ''
      ).trim();
      const view = parsedUrl.searchParams.get('view');

      if (caseId) {
        if (!/^[0-9]+$/.test(caseId)) {
          return sendJSON(res, 400, {
            success: false,
            error: 'Case ROWID must be a numeric value'
          });
        }

        if (view === 'graph') {
          const graph = await getCorrelationGraph(datastore, caseId);

          return sendJSON(res, 200, {
            success: true,
            caseId,
            graph
          });
        }

        const timelineEvents = await getTimelineEvents(datastore, caseId);

        return sendJSON(res, 200, {
          success: true,
          caseId,
          events: timelineEvents
        });
      }

      if (!evidenceId || !/^[0-9]+$/.test(evidenceId)) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Evidence ROWID must be a numeric value'
        });
      }

      evidenceRow = await evidenceTable.getRow(evidenceId);

      if (!evidenceRow) {
        return sendJSON(res, 404, {
          success: false,
          error: 'Evidence record was not found'
        });
      }

      const entities = await getPersistedEntities(
        datastore,
        evidenceId
      );

      return sendJSON(res, 200, {
        success: true,
        evidenceId,
        entities
      });
    }

    if (req.method !== 'POST') {
      return sendJSON(res, 405, {
        success: false,
        error: 'Only POST requests are allowed'
      });
    }

    const requestBody = await readRequestBody(req);
    const evidenceId = getEvidenceId(requestBody);

    if (!evidenceId || !/^[0-9]+$/.test(evidenceId)) {
      return sendJSON(res, 400, {
        success: false,
        error: 'Evidence ROWID must be a numeric value'
      });
    }

    evidenceRow = await evidenceTable.getRow(evidenceId);

    if (!evidenceRow) {
      return sendJSON(res, 404, {
        success: false,
        error: 'Evidence record was not found'
      });
    }

    const storageObjectKey = String(evidenceRow.StorageObjectKey || '').trim();
    if (!storageObjectKey) {
      return sendJSON(res, 422, {
        success: false,
        error: 'Evidence record has no StorageObjectKey'
      });
    }

    if (!isSupportedTextEvidence(evidenceRow)) {
      return sendJSON(res, 422, {
        success: false,
        supported: false,
        error: 'This processor currently supports plain-text evidence only'
      });
    }

    await evidenceTable.updateRow({
      ROWID: evidenceId,
      ProcessingStatus: 'PROCESSING'
    });
    processingStarted = true;

    const bucket = app.stratus().bucket(BUCKET_NAME);
    const objectStream = await bucket.getObject(storageObjectKey);
    const contentBuffer = await readStream(objectStream);
    const extractedText = contentBuffer.toString('utf8');

    const extractedEntities = extractEntities(extractedText);
    const persistedEntities = await persistEntities(
      datastore,
      evidenceRow,
      evidenceId,
      extractedEntities
    );
    const extractedEvents = extractTimelineEvents(extractedText);
    const persistedEvents = await persistTimelineEvents(
      datastore,
      evidenceRow,
      evidenceId,
      extractedEvents
    );

    await evidenceTable.updateRow({
      ROWID: evidenceId,
      ProcessingStatus: 'PROCESSED'
    });

    return sendJSON(res, 200, {
      success: true,
      supported: true,
      evidenceId,
      processingStatus: 'PROCESSED',
      extractedText,
      entities: persistedEntities,
      timelineEvents: persistedEvents
    });
  } catch (error) {
    console.error('Evidence processing error:', error);

    if (processingStarted && evidenceTable && evidenceRow) {
      try {
        await evidenceTable.updateRow({
          ROWID: evidenceRow.ROWID,
          ProcessingStatus: 'FAILED'
        });
      } catch (statusError) {
        console.error(
          'Failed to mark evidence processing as FAILED:',
          statusError
        );
      }
    }

    return sendJSON(res, 500, {
      success: false,
      error: error.message || 'Evidence processing failed'
    });
  }
};

function getEvidenceId(body) {
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return String(body.evidenceId || body.ROWID || '').trim();
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      return getEvidenceId(JSON.parse(body.toString()));
    } catch {
      return '';
    }
  }

  return '';
}

function isSupportedTextEvidence(row) {
  const mimeType = String(row.MimeType || '').toLowerCase().trim();
  const fileName = String(row.OriginalFileName || '').toLowerCase().trim();

  return (
    SUPPORTED_MIME_TYPES.has(mimeType) ||
    fileName.endsWith('.txt')
  );
}

function extractEntities(text) {
  const sourceText = String(text || '');
  const entities = [];
  const addMatches = (entityType, pattern, confidence, normalize) => {
    for (const match of sourceText.matchAll(pattern)) {
      const rawValue = match[0];
      const start = match.index;
      const value = normalize(rawValue);

      if (!value) {
        continue;
      }

      entities.push({
        EntityType: entityType,
        EntityValue: value,
        Confidence: confidence,
        SourceLocation: `Character offsets ${start}-${start + rawValue.length}`
      });
    }
  };

  const emailMatches = collectMatches(
    sourceText,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  );
  const urlMatches = collectMatches(
    sourceText,
    /https?:\/\/[^\s<>"')]+/gi,
    trimTrailingUrlPunctuation
  );

  addMatches(
    'EMAIL',
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    0.99,
    (value) => value.toLowerCase()
  );

  addMatches(
    'URL',
    /https?:\/\/[^\s<>"')]+/gi,
    0.98,
    trimTrailingUrlPunctuation
  );

  addMatches(
    'IP_ADDRESS',
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    0.99,
    (value) => isValidIPv4(value) ? value : ''
  );

  for (const match of sourceText.matchAll(
    /(?<![@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?![\w])/gi
  )) {
    const start = match.index;
    const value = match[0].toLowerCase();

    if (
      isWithinMatch(start, emailMatches) ||
      isWithinMatch(start, urlMatches)
    ) {
      continue;
    }

    entities.push({
      EntityType: 'DOMAIN',
      EntityValue: value,
      Confidence: 0.95,
      SourceLocation: `Character offsets ${start}-${start + match[0].length}`
    });
  }

  addMatches(
    'PHONE',
    /\+?[1-9]\d{1,2}[\s.-]?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
    0.90,
    (value) => value.trim()
  );

  addMatches(
    'TRANSACTION_REFERENCE',
    /\b(?:TXN|TRX|REF|ORDER)[-_][A-Z0-9-]{3,}\b/gi,
    0.97,
    (value) => value.toUpperCase()
  );

  const uniqueEntities = new Map();

  for (const entity of entities) {
    const key = `${entity.EntityType}:${entity.EntityValue.toLowerCase()}`;

    if (!uniqueEntities.has(key)) {
      uniqueEntities.set(key, entity);
    }
  }

  return Array.from(uniqueEntities.values());
}

function collectMatches(text, pattern, normalize = (value) => value) {
  return Array.from(text.matchAll(pattern)).map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    value: normalize(match[0])
  }));
}

function isWithinMatch(start, matches) {
  return matches.some((match) => start >= match.start && start < match.end);
}

function trimTrailingUrlPunctuation(value) {
  return value.replace(/[.,!?;:]+$/, '');
}

function isValidIPv4(value) {
  const octets = value.split('.');

  return (
    octets.length === 4 &&
    octets.every((octet) => {
      const number = Number(octet);
      return octet.length > 0 && number >= 0 && number <= 255;
    })
  );
}

function extractTimelineEvents(text) {
  const sourceText = String(text || '');
  const timestampPattern = /\b(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\b/g;
  const matches = Array.from(sourceText.matchAll(timestampPattern));
  const events = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const timestamp = match[1];
    const nextStart = matches[index + 1]?.index ?? sourceText.length;
    const associatedText = sourceText
      .slice(match.index + match[0].length, nextStart)
      .trim();
    const description = buildEventDescription(associatedText);
    const eventType = classifyEvent(associatedText);

    if (!isValidCatalystDateTime(timestamp)) {
      continue;
    }

    events.push({
      EventTime: timestamp,
      EventType: eventType,
      Description: description,
      Confidence: eventType === 'OBSERVED_EVENT' ? 0.80 : 0.90,
      SourceLocation: `Character offsets ${match.index}-${nextStart}`
    });
  }

  return events;
}

function isValidCatalystDateTime(value) {
  const [datePart, timePart] = value.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes &&
    date.getSeconds() === seconds
  );
}

function buildEventDescription(associatedText) {
  const lines = associatedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (lines.slice(0, 4).join(' | ') || 'Timestamped event recorded in evidence text')
    .slice(0, 500);
}

function classifyEvent(associatedText) {
  const text = associatedText.toLowerCase();

  if (/transaction|txn[-_]|payment|transfer|purchase/.test(text)) {
    return 'TRANSACTION';
  }

  if (/sender:|recipient:|message:|email|communicat|reply|conversation/.test(text)) {
    return 'COMMUNICATION';
  }

  if (/login|log in|access|sign[- ]?in|authentication|verification/.test(text)) {
    return 'ACCESS';
  }

  if (/reported|report|unauthorized|complaint|alert/.test(text)) {
    return 'REPORT';
  }

  return 'OBSERVED_EVENT';
}

async function persistEntities(datastore, evidenceRow, evidenceId, entities) {
  const entityTable = datastore.table('ExtractedEntity');
  const existingEntities = await getPersistedEntities(
    datastore,
    evidenceId
  );
  const existingKeys = new Set(
    existingEntities.map((entity) =>
      `${entity.EntityType}:${String(entity.EntityValue).toLowerCase()}`
    )
  );
  const createdAt = getCatalystDateTime();

  for (const entity of entities) {
    const key = `${entity.EntityType}:${entity.EntityValue.toLowerCase()}`;

    if (existingKeys.has(key)) {
      continue;
    }

    await entityTable.insertRow({
      CaseMasterID: String(evidenceRow.CaseMasterID),
      EvidenceID: String(evidenceId),
      EntityType: entity.EntityType,
      EntityValue: entity.EntityValue,
      Confidence: entity.Confidence,
      SourceLocation: entity.SourceLocation,
      Verified: false,
      CreatedAt: createdAt
    });

    existingKeys.add(key);
  }

  return getPersistedEntities(datastore, evidenceId);
}

async function getPersistedEntities(datastore, evidenceId) {
  const entityTable = datastore.table('ExtractedEntity');
  const rows = await entityTable.getAllRows();

  return rows.filter((row) =>
    String(row.EvidenceID) === String(evidenceId)
  );
}

async function getCorrelationGraph(datastore, caseId) {
  const evidenceTable = datastore.table('Evidence');
  const entityTable = datastore.table('ExtractedEntity');
  const evidenceRows = (await evidenceTable.getAllRows()).filter((row) =>
    String(row.CaseMasterID) === String(caseId)
  );
  const evidenceIds = new Set(
    evidenceRows.map((row) => String(row.ROWID))
  );
  const entityRows = (await entityTable.getAllRows()).filter((row) =>
    evidenceIds.has(String(row.EvidenceID)) &&
    String(row.CaseMasterID) === String(caseId)
  );
  const groupedEntities = new Map();

  for (const row of entityRows) {
    const normalizedValue = normalizeCorrelationValue(
      row.EntityType,
      row.EntityValue
    );

    if (!normalizedValue) {
      continue;
    }

    const key = `${String(row.EntityType || '').toUpperCase()}:${normalizedValue}`;
    const group = groupedEntities.get(key) || {
      EntityType: String(row.EntityType || '').toUpperCase(),
      EntityValue: String(row.EntityValue || '').trim(),
      normalizedValue,
      evidenceIds: new Set()
    };

    group.evidenceIds.add(String(row.EvidenceID));
    groupedEntities.set(key, group);
  }

  const correlatedGroups = Array.from(groupedEntities.values())
    .filter((group) => group.evidenceIds.size >= 2);
  const correlatedEvidenceIds = new Set(
    correlatedGroups.flatMap((group) => Array.from(group.evidenceIds))
  );
  const nodes = [];
  const edges = [];

  for (const evidence of evidenceRows) {
    const evidenceId = String(evidence.ROWID);

    if (!correlatedEvidenceIds.has(evidenceId)) {
      continue;
    }

    nodes.push({
      id: `evidence:${evidenceId}`,
      type: 'EVIDENCE',
      evidenceId,
      label: String(evidence.OriginalFileName || evidenceId)
    });
  }

  for (const group of correlatedGroups) {
    const entityId = `entity:${group.EntityType}:${group.normalizedValue}`;
    nodes.push({
      id: entityId,
      type: 'ENTITY',
      entityType: group.EntityType,
      entityValue: group.EntityValue,
      evidenceCount: group.evidenceIds.size
    });

    for (const evidenceId of group.evidenceIds) {
      edges.push({
        id: `contains:${evidenceId}:${entityId}`,
        source: `evidence:${evidenceId}`,
        target: entityId,
        type: 'CONTAINS'
      });
    }
  }

  return {
    nodes,
    edges,
    correlations: correlatedGroups.map((group) => ({
      entityType: group.EntityType,
      entityValue: group.EntityValue,
      evidenceIds: Array.from(group.evidenceIds),
      evidenceCount: group.evidenceIds.size
    }))
  };
}

function normalizeCorrelationValue(entityType, value) {
  const type = String(entityType || '').toUpperCase();
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  if (type === 'EMAIL' || type === 'DOMAIN' || type === 'TRANSACTION_REFERENCE') {
    return rawValue.toLowerCase();
  }

  if (type === 'IP_ADDRESS') {
    return isValidIPv4(rawValue) ? rawValue : '';
  }

  if (type === 'PHONE') {
    const normalizedPhone = rawValue.replace(/[\s().-]/g, '');
    return /^\+?\d{7,15}$/.test(normalizedPhone)
      ? normalizedPhone
      : '';
  }

  if (type === 'URL') {
    return trimTrailingUrlPunctuation(rawValue);
  }

  return rawValue;
}

async function persistTimelineEvents(datastore, evidenceRow, evidenceId, events) {
  const timelineTable = datastore.table('TimelineEvent');
  const existingEvents = await getTimelineEvents(datastore, null, evidenceId);
  const existingKeys = new Set(
    existingEvents.map((event) => buildTimelineKey(event))
  );

  for (const event of events) {
    const eventRow = {
      CaseMasterID: String(evidenceRow.CaseMasterID),
      EvidenceID: String(evidenceId),
      EventTime: event.EventTime,
      EventType: event.EventType,
      Description: event.Description,
      Confidence: event.Confidence,
      CreatedByAI: false
    };
    const key = buildTimelineKey(eventRow);

    if (existingKeys.has(key)) {
      continue;
    }

    await timelineTable.insertRow(eventRow);
    existingKeys.add(key);
  }

  return getTimelineEvents(datastore, null, evidenceId);
}

async function getTimelineEvents(datastore, caseId, evidenceId) {
  const timelineTable = datastore.table('TimelineEvent');
  const rows = await timelineTable.getAllRows();
  const filteredRows = rows.filter((row) => {
    const caseMatches = caseId === null ||
      String(row.CaseMasterID) === String(caseId);
    const evidenceMatches = evidenceId === undefined ||
      String(row.EvidenceID) === String(evidenceId);

    return caseMatches && evidenceMatches;
  });

  return filteredRows.sort((left, right) =>
    String(left.EventTime).localeCompare(String(right.EventTime))
  );
}

function buildTimelineKey(event) {
  return [
    event.EvidenceID,
    event.EventTime,
    event.EventType,
    event.Description
  ].join('|');
}

function getCatalystDateTime() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function readRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return req.body;
  }

  return readStream(req);
}

function readStream(stream) {
  if (!stream || typeof stream.on !== 'function') {
    return Promise.reject(new Error('Request or object body was not readable'));
  }

  if (stream instanceof Readable && stream.readableEnded) {
    return Promise.resolve(Buffer.alloc(0));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  if (res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify(data));
}
