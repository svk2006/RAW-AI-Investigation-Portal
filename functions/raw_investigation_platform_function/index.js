const catalyst = require('zcatalyst-sdk-node');
const { PERMISSIONS, authenticateAndAuthorize } = require('./rawAuth');

/**
 * @param {import('./types/basicio').Context} context
 * @param {import('./types/basicio').BasicIO} basicIO
 */
module.exports = async (context, basicIO) => {
  try {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();

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