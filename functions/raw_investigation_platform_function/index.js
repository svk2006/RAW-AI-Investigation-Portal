const catalyst = require('zcatalyst-sdk-node');

/**
 * @param {import('./types/basicio').Context} context
 * @param {import('./types/basicio').BasicIO} basicIO
 */
module.exports = async (context, basicIO) => {
	try {
		const app = catalyst.initialize(context);
		const datastore = app.datastore();

		const caseId = basicIO.getArgument('caseId');
		console.log('DEBUG caseId received:', caseId);

		const caseTable = datastore.table('CaseMaster');

		if (caseId) {
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