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

    const app = catalyst.initialize(req);
    const datastore = app.datastore();
    evidenceTable = datastore.table('Evidence');
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

    await evidenceTable.updateRow({
      ROWID: evidenceId,
      ProcessingStatus: 'PROCESSED'
    });

    return sendJSON(res, 200, {
      success: true,
      supported: true,
      evidenceId,
      processingStatus: 'PROCESSED',
      extractedText
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
