const catalyst = require('zcatalyst-sdk-node');
const { PERMISSIONS, authenticateAndAuthorize } = require('./rawAuth');
const { logAuditEvent, getCatalystDatetime } = require('./auditLogger');

/**
 * @param {import('./types/basicio').Context} context
 * @param {import('./types/basicio').BasicIO} basicIO
 */
module.exports = async (context, basicIO) => {
  try {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();
    const zcql = app.zcql();

    const action = basicIO.getArgument('action');
    const caseId = basicIO.getArgument('caseId');

    // ACTION: getProfile
    if (action === 'getProfile') {
      const auth = await authenticateAndAuthorize(app);
      if (!auth.authorized) {
        basicIO.write(
          JSON.stringify({
            success: false,
            status: auth.status,
            error: auth.error
          })
        );
        context.close();
        return;
      }

      basicIO.write(
        JSON.stringify({
          success: true,
          profile: {
            displayName: auth.employee.firstName || 'A. Kumar',
            kgid: auth.employee.kgid || 'POL100821',
            role: auth.role || 'INVESTIGATOR',
            permissions: auth.permissions || []
          }
        })
      );
      context.close();
      return;
    }

    // ACTION: logout
    if (action === 'logout') {
      const auth = await authenticateAndAuthorize(app);
      if (auth.authorized) {
        await logAuditEvent({
          app,
          employeeKGID: auth.employee.kgid,
          action: 'LOGOUT',
          resourceType: 'AUTH',
          description: 'Officer signed out of RAW Investigation Intelligence Platform',
          status: 'SUCCESS'
        });
      }

      basicIO.write(
        JSON.stringify({
          success: true,
          message: 'Logout audit event recorded successfully'
        })
      );
      context.close();
      return;
    }

    // ACTION: getAuditLog
    if (action === 'getAuditLog') {
      const auth = await authenticateAndAuthorize(app, PERMISSIONS.VIEW_AUDIT);
      if (!auth.authorized) {
        basicIO.write(
          JSON.stringify({
            success: false,
            status: auth.status || 403,
            error: auth.error || 'You do not have permission to perform this operation.'
          })
        );
        context.close();
        return;
      }

      let auditRows = [];
      try {
        const query = `SELECT ROWID, CaseMasterID, EmployeeKGID, Action, ResourceType, ResourceID, Description, Status, CreatedAt FROM AuditLog ORDER BY CreatedAt DESC`;
        const zqlRes = await zcql.executeZCQLQuery(query);
        auditRows = (zqlRes || []).map((r) => {
          const item = r.AuditLog || r;
          return {
            id: String(item.ROWID),
            caseMasterId: item.CaseMasterID ? String(item.CaseMasterID) : null,
            employeeKGID: String(item.EmployeeKGID || ''),
            action: String(item.Action || ''),
            resourceType: String(item.ResourceType || ''),
            resourceId: item.ResourceID ? String(item.ResourceID) : null,
            description: String(item.Description || ''),
            status: String(item.Status || 'SUCCESS'),
            createdAt: String(item.CreatedAt || '')
          };
        });
      } catch (aErr) {
        console.error('[RAW Audit] ZCQL getAuditLog error:', aErr.message);
        const auditTable = datastore.table('AuditLog');
        const allRows = await auditTable.getAllRows();
        auditRows = (allRows || []).map((item) => ({
          id: String(item.ROWID),
          caseMasterId: item.CaseMasterID ? String(item.CaseMasterID) : null,
          employeeKGID: String(item.EmployeeKGID || ''),
          action: String(item.Action || ''),
          resourceType: String(item.ResourceType || ''),
          resourceId: item.ResourceID ? String(item.ResourceID) : null,
          description: String(item.Description || ''),
          status: String(item.Status || 'SUCCESS'),
          createdAt: String(item.CreatedAt || '')
        }));
      }

      basicIO.write(
        JSON.stringify({
          success: true,
          count: auditRows.length,
          auditLogs: auditRows
        })
      );
      context.close();
      return;
    }

    // ACTION: getReport
    if (action === 'getReport') {
      if (!caseId || !/^[0-9]+$/.test(String(caseId).trim())) {
        basicIO.write(
          JSON.stringify({
            success: false,
            error: 'caseId query argument is required and must be numeric'
          })
        );
        context.close();
        return;
      }

      const caseIdStr = String(caseId).trim();
      const auth = await authenticateAndAuthorize(app, PERMISSIONS.VIEW_CASE, caseIdStr);
      if (!auth.authorized) {
        basicIO.write(
          JSON.stringify({
            success: false,
            status: auth.status,
            error: auth.error
          })
        );
        context.close();
        return;
      }

      const caseTable = datastore.table('CaseMaster');
      const caseRow = await caseTable.getRow(caseIdStr);

      if (!caseRow) {
        basicIO.write(
          JSON.stringify({
            success: false,
            error: 'Case record not found'
          })
        );
        context.close();
        return;
      }

      // Fetch related evidence, entities, timeline, and insights for report
      let evidenceList = [];
      let entityList = [];
      let timelineList = [];
      let insightList = [];

      try {
        const evZql = `SELECT ROWID, CaseMasterID, EvidenceType, OriginalFileName, UploadedBy, UploadedAt, ProcessingStatus, FileSize, SourceDescription FROM Evidence WHERE CaseMasterID = '${caseIdStr}' ORDER BY UploadedAt DESC`;
        const evRes = await zcql.executeZCQLQuery(evZql);
        evidenceList = (evRes || []).map((r) => r.Evidence || r);
      } catch (e) { console.warn('Report evidence fetch error:', e.message); }

      try {
        const entZql = `SELECT ROWID, CaseMasterID, EvidenceID, EntityType, EntityValue, Confidence, SourceLocation, Verified, CreatedAt FROM ExtractedEntity WHERE CaseMasterID = '${caseIdStr}' ORDER BY CreatedAt DESC`;
        const entRes = await zcql.executeZCQLQuery(entZql);
        entityList = (entRes || []).map((r) => r.ExtractedEntity || r);
      } catch (e) { console.warn('Report entity fetch error:', e.message); }

      try {
        const timeZql = `SELECT ROWID, CaseMasterID, EvidenceID, EventTime, EventType, Description, CreatedByAI FROM TimelineEvent WHERE CaseMasterID = '${caseIdStr}' ORDER BY EventTime ASC`;
        const timeRes = await zcql.executeZCQLQuery(timeZql);
        timelineList = (timeRes || []).map((r) => r.TimelineEvent || r);
      } catch (e) { console.warn('Report timeline fetch error:', e.message); }

      try {
        const insZql = `SELECT ROWID, CaseMasterID, EvidenceID, InsightType, Title, Description, Confidence, Status, GeneratedAt FROM AIInsight WHERE CaseMasterID = '${caseIdStr}' ORDER BY GeneratedAt DESC`;
        const insRes = await zcql.executeZCQLQuery(insZql);
        insightList = (insRes || []).map((r) => r.AIInsight || r);
      } catch (e) { console.warn('Report insight fetch error:', e.message); }

      await logAuditEvent({
        app,
        caseMasterId: caseIdStr,
        employeeKGID: auth.employee.kgid,
        action: 'REPORT_GENERATE',
        resourceType: 'REPORT',
        resourceId: caseIdStr,
        description: `Generated investigation report for Case ${caseRow.CaseNo || caseIdStr}`,
        status: 'SUCCESS'
      });

      basicIO.write(
        JSON.stringify({
          success: true,
          reportData: {
            caseMaster: caseRow,
            officer: auth.employee,
            evidenceList,
            entityList,
            timelineList,
            insightList,
            generatedAt: getCatalystDatetime()
          }
        })
      );
      context.close();
      return;
    }

    // ACTION: auditReportExport
    if (action === 'auditReportExport') {
      if (!caseId || !/^[0-9]+$/.test(String(caseId).trim())) {
        basicIO.write(
          JSON.stringify({
            success: false,
            error: 'caseId query argument is required and must be numeric'
          })
        );
        context.close();
        return;
      }

      const caseIdStr = String(caseId).trim();
      const auth = await authenticateAndAuthorize(app, PERMISSIONS.VIEW_CASE, caseIdStr);
      if (!auth.authorized) {
        basicIO.write(
          JSON.stringify({
            success: false,
            status: auth.status,
            error: auth.error
          })
        );
        context.close();
        return;
      }

      await logAuditEvent({
        app,
        caseMasterId: caseIdStr,
        employeeKGID: auth.employee.kgid,
        action: 'REPORT_EXPORT',
        resourceType: 'REPORT',
        resourceId: caseIdStr,
        description: `Exported investigation report PDF for Case ${caseIdStr}`,
        status: 'SUCCESS'
      });

      basicIO.write(
        JSON.stringify({
          success: true,
          message: 'Report export audit logged successfully'
        })
      );
      context.close();
      return;
    }

    const caseTable = datastore.table('CaseMaster');

    if (caseId) {
      const auth = await authenticateAndAuthorize(app, PERMISSIONS.VIEW_CASE, caseId);
      if (!auth.authorized) {
        basicIO.write(
          JSON.stringify({
            success: false,
            status: auth.status,
            error: auth.error
          })
        );
        context.close();
        return;
      }

      const row = await caseTable.getRow(caseId);

      await logAuditEvent({
        app,
        caseMasterId: String(caseId),
        employeeKGID: auth.employee.kgid,
        action: 'CASE_ACCESS',
        resourceType: 'CASE',
        resourceId: String(caseId),
        description: `Accessed investigation workspace for Case ${row ? (row.CaseNo || caseId) : caseId}`,
        status: 'SUCCESS'
      });

      basicIO.write(
        JSON.stringify({
          success: true,
          case: row
        })
      );

      context.close();
      return;
    }

    const auth = await authenticateAndAuthorize(app, PERMISSIONS.VIEW_CASE);
    if (!auth.authorized) {
      basicIO.write(
        JSON.stringify({
          success: false,
          status: auth.status,
          error: auth.error
        })
      );
      context.close();
      return;
    }

    const rows = await caseTable.getAllRows();

    basicIO.write(
      JSON.stringify({
        success: true,
        count: rows.length,
        cases: rows
      })
    );

  } catch (error) {
    console.error('RAW Backend Error:', error);

    basicIO.write(
      JSON.stringify({
        success: false,
        error: error.message
      })
    );
  }

  context.close();
};