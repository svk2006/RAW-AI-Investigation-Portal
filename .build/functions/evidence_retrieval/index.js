'use strict';

const catalyst = require('zcatalyst-sdk-node');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return sendJSON(res, 405, {
        success: false,
        error: 'Only GET requests are allowed'
      });
    }

    const requestUrl = req.url || '';
    const parsedUrl = new URL(requestUrl, 'http://localhost');
    const caseId = parsedUrl.searchParams.get('caseId');

    if (!caseId) {
      return sendJSON(res, 400, {
        success: false,
        error: 'caseId query parameter is required'
      });
    }

    const caseIdValue = String(caseId).trim();

    if (!/^[0-9]+$/.test(caseIdValue)) {
      return sendJSON(res, 400, {
        success: false,
        error: 'caseId must be a numeric ROWID'
      });
    }

    const app = catalyst.initialize(req);
    const zcql = app.zcql();
    const rows = await zcql.executeZCQLQuery(
      `SELECT ROWID, CaseMasterID, EvidenceType, OriginalFileName, StorageObjectKey, SHA256Hash, UploadedBy, UploadedAt, ProcessingStatus, MimeType, FileSize, SourceDescription FROM Evidence WHERE CaseMasterID = ${caseIdValue} ORDER BY UploadedAt DESC`
    );

    console.log('Evidence retrieval raw rows:', JSON.stringify(rows, null, 2));

    const normalizeValue = (source, keys) => {
      for (const key of keys) {
        if (source && Object.prototype.hasOwnProperty.call(source, key)) {
          return source[key];
        }
      }
      return null;
    };

    const extractRow = (inputRow) => {
      if (!inputRow || typeof inputRow !== 'object') {
        return null;
      }

      let source = inputRow;

      const nestedKeys = [
        'Evidence',
        'evidence',
        'ROW',
        'row',
        'record',
        'data'
      ];

      for (const key of nestedKeys) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          source = source[key];
          break;
        }
      }

      const normalized = {
        ROWID: normalizeValue(source, ['ROWID', 'rowId', 'rowid']),
        CaseMasterID: normalizeValue(source, ['CaseMasterID', 'caseMasterId', 'casemasterid']),
        EvidenceType: normalizeValue(source, ['EvidenceType', 'evidenceType', 'evidencetype']),
        OriginalFileName: normalizeValue(source, ['OriginalFileName', 'originalFileName', 'originalfilename']),
        StorageObjectKey: normalizeValue(source, ['StorageObjectKey', 'storageObjectKey', 'storageobjectkey']),
        SHA256Hash: normalizeValue(source, ['SHA256Hash', 'sha256Hash', 'sha256hash']),
        UploadedBy: normalizeValue(source, ['UploadedBy', 'uploadedBy', 'uploadedby']),
        UploadedAt: normalizeValue(source, ['UploadedAt', 'uploadedAt', 'uploadedat']),
        ProcessingStatus: normalizeValue(source, ['ProcessingStatus', 'processingStatus', 'processingstatus']),
        MimeType: normalizeValue(source, ['MimeType', 'mimeType', 'mimetype']),
        FileSize: normalizeValue(source, ['FileSize', 'fileSize', 'filesize']),
        SourceDescription: normalizeValue(source, ['SourceDescription', 'sourceDescription', 'sourcedescription'])
      };

      return normalized;
    };

    const normalizedEvidence = Array.isArray(rows)
      ? rows
          .map(extractRow)
          .filter((row) => row !== null)
      : [];

    if (normalizedEvidence.length > 0) {
      console.log(
        'Evidence retrieval normalized row:',
        JSON.stringify(normalizedEvidence[0], null, 2)
      );
    }

    return sendJSON(res, 200, {
      success: true,
      count: normalizedEvidence.length,
      evidence: normalizedEvidence
    });
  } catch (error) {
    console.error('Evidence retrieval error:', error);

    return sendJSON(res, 500, {
      success: false,
      error: error.message || 'Failed to retrieve evidence'
    });
  }
};

function sendJSON(res, statusCode, data) {
  if (res.writableEnded) {
    return;
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json'
  });

  res.end(JSON.stringify(data));
}
