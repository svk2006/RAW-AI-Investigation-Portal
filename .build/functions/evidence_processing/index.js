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
      entities: persistedEntities
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
