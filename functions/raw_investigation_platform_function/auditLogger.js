'use strict';

function getCatalystDatetime(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Server-side audit event logger for RAW Investigation Intelligence Platform.
 * Inserts structured audit rows into Data Store table: AuditLog.
 * Safely handles errors so audit logging failures do not crash operational workflows.
 */
async function logAuditEvent({
  app,
  caseMasterId = null,
  employeeKGID,
  action,
  resourceType,
  resourceId = null,
  description,
  status = 'SUCCESS'
}) {
  try {
    if (!app || !employeeKGID || !action || !resourceType || !description) {
      console.warn('[RAW Audit] Missing required parameters for audit logging');
      return null;
    }

    const datastore = app.datastore();
    const auditTable = datastore.table('AuditLog');

    const auditRow = {
      EmployeeKGID: String(employeeKGID).trim(),
      Action: String(action).trim(),
      ResourceType: String(resourceType).trim(),
      Description: String(description).trim(),
      Status: String(status).trim(),
      CreatedAt: getCatalystDatetime()
    };

    if (caseMasterId) {
      auditRow.CaseMasterID = String(caseMasterId).trim();
    }
    if (resourceId) {
      auditRow.ResourceID = String(resourceId).trim();
    }

    const inserted = await auditTable.insertRow(auditRow);
    return inserted;
  } catch (err) {
    console.error('[RAW Audit] Audit insertion failed:', err.message || err);
    return null;
  }
}

module.exports = {
  logAuditEvent,
  getCatalystDatetime
};
