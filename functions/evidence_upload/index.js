'use strict';

const Busboy = require('busboy');
const crypto = require('crypto');
const { Readable } = require('stream');
const catalyst = require('zcatalyst-sdk-node');

module.exports = async (req, res) => {
	try {
		if (req.method !== 'POST') {
			return sendJSON(res, 405, {
				success: false,
				error: 'Only POST requests are allowed'
			});
		}

		const contentType = req.headers['content-type'];

		if (
			!contentType ||
			!contentType.includes('multipart/form-data')
		) {
			return sendJSON(res, 400, {
				success: false,
				error: 'Request must use multipart/form-data'
			});
		}

		const busboy = Busboy({
			headers: req.headers,
			limits: {
				files: 1,
				fileSize: 25 * 1024 * 1024,
				fields: 10
			}
		});

		const fields = {};

		let uploadedFile = null;
		let fileTooLarge = false;
		let multipartError = null;

		busboy.on('field', (name, value) => {
			fields[name] = value;
		});

		busboy.on('file', (fieldName, file, info) => {
			const chunks = [];
			let fileSize = 0;

			file.on('data', (chunk) => {
				chunks.push(chunk);
				fileSize += chunk.length;
			});

			file.on('limit', () => {
				fileTooLarge = true;
			});

			file.on('error', (error) => {
				console.error(
					'Evidence file stream error:',
					error
				);

				multipartError = error;
			});

			file.on('end', () => {
				uploadedFile = {
					fieldName: fieldName,
					originalFileName:
						info.filename || 'evidence-file',
					mimeType:
						info.mimeType ||
						'application/octet-stream',
					size: fileSize,
					buffer: Buffer.concat(chunks)
				};
			});
		});

		busboy.on('error', (error) => {
			console.error(
				'Multipart parsing error:',
				error
			);

			multipartError = error;
		});

		busboy.on('finish', async () => {
			try {
				if (multipartError) {
					return sendJSON(res, 400, {
						success: false,
						error:
							'Unable to process evidence upload'
					});
				}

				if (fileTooLarge) {
					return sendJSON(res, 413, {
						success: false,
						error:
							'Evidence exceeds the 25 MB development limit'
					});
				}

				if (!uploadedFile) {
					return sendJSON(res, 400, {
						success: false,
						error:
							'No evidence file received'
					});
				}

				if (!fields.caseId) {
					return sendJSON(res, 400, {
						success: false,
						error:
							'caseId is required'
					});
				}

				if (!fields.evidenceType) {
					return sendJSON(res, 400, {
						success: false,
						error:
							'evidenceType is required'
					});
				}

				if (uploadedFile.size === 0) {
					return sendJSON(res, 400, {
						success: false,
						error:
							'Empty evidence files are not allowed'
					});
				}

				/*
				 * -------------------------------------------------
				 * VALIDATE MIME TYPE
				 *
				 * Only accept evidence types that the system
				 * supports for storage. Unsupported formats are
				 * rejected before any Stratus interaction.
				 * -------------------------------------------------
				 */

				const ACCEPTED_MIME_TYPES = new Set([
					'text/plain',
					'application/pdf',
					'image/png',
					'image/jpeg'
				]);

				const submittedMime = String(
					uploadedFile.mimeType || ''
				).toLowerCase().split(';')[0].trim();

				if (!ACCEPTED_MIME_TYPES.has(submittedMime)) {
					return sendJSON(res, 415, {
						success: false,
						error:
							'Unsupported evidence file type. ' +
							'RAW currently accepts: ' +
							'plain text (.txt), PDF (.pdf), ' +
							'PNG image (.png), ' +
							'JPEG image (.jpg/.jpeg).'
					});
				}

				/*
				 * -------------------------------------------------
				 * GENERATE SHA-256
				 * -------------------------------------------------
				 */

				const sha256 = crypto
					.createHash('sha256')
					.update(uploadedFile.buffer)
					.digest('hex');

				console.log(
					'Evidence SHA-256:',
					sha256
				);

				/*
				 * -------------------------------------------------
				 * CREATE SAFE FILE NAME
				 * -------------------------------------------------
				 */

				const safeFileName =
					sanitizeFileName(
						uploadedFile.originalFileName
					);

				/*
				 * -------------------------------------------------
				 * CREATE UNIQUE STRATUS OBJECT KEY
				 * -------------------------------------------------
				 */

				const uniqueId =
					crypto.randomUUID();

				const storageObjectKey =
					`cases/${fields.caseId}/evidence/` +
					`${uniqueId}-${safeFileName}`;

				console.log(
					'Storage object key:',
					storageObjectKey
				);

				/*
				 * -------------------------------------------------
				 * INITIALIZE CATALYST
				 * -------------------------------------------------
				 */

				const app =
					catalyst.initialize(req);

				/*
				 * -------------------------------------------------
				 * UPLOAD FILE TO STRATUS
				 * -------------------------------------------------
				 */

				const stratus =
					app.stratus();

				const bucket =
					stratus.bucket(
						'raw-evidence-vault'
					);

				const fileStream =
					Readable.from(
						uploadedFile.buffer
					);

				console.log(
					'Uploading evidence to Stratus...'
				);

				await bucket.putObject(
					storageObjectKey,
					fileStream,
					{
						contentType:
							uploadedFile.mimeType,

						metaData: {
							caseId:
								String(
									fields.caseId
								),

							sha256:
								sha256,

							originalFileName:
								safeFileName,

							evidenceType:
								String(
									fields.evidenceType
								)
						}
					}
				);

				console.log(
					'Evidence stored successfully in Stratus'
				);

				/*
				 * -------------------------------------------------
				 * DATA STORE
				 * -------------------------------------------------
				 */

				const datastore =
					app.datastore();

				const evidenceTable =
					datastore.table(
						'Evidence'
					);

				/*
				 * -------------------------------------------------
				 * CREATE UPLOAD TIMESTAMP
				 * -------------------------------------------------
				 */

				const uploadedAt =
					getCatalystDateTime();

				console.log(
					'UploadedAt:',
					uploadedAt
				);

				/*
				 * -------------------------------------------------
				 * BUILD EVIDENCE ROW
				 * -------------------------------------------------
				 */

				const rowData = {
					CaseMasterID:
						String(
							fields.caseId
						),

					EvidenceType:
						String(
							fields.evidenceType
						),

					OriginalFileName:
						String(
							uploadedFile.originalFileName
						),

					StorageObjectKey:
						String(
							storageObjectKey
						),

					SHA256Hash:
						String(
							sha256
						),

					UploadedBy:
						'Development Investigator',

					UploadedAt:
						uploadedAt,

					ProcessingStatus:
						'UPLOADED',

					MimeType:
						String(
							uploadedFile.mimeType
						),

					FileSize:
						uploadedFile.size,

					SourceDescription:
						fields.sourceDescription
							? String(
								fields.sourceDescription
							)
							: ''
				};

				console.log(
					'Evidence metadata being inserted:'
				);

				console.log(rowData);

				/*
				 * -------------------------------------------------
				 * INSERT EVIDENCE METADATA
				 * -------------------------------------------------
				 */

				let insertedRow;

				try {
					insertedRow =
						await evidenceTable.insertRow(
							rowData
						);
				} catch (databaseError) {
					console.error(
						'Evidence metadata insertion failed:',
						databaseError
					);

					try {
						await bucket.deleteObject(
							storageObjectKey
						);

						console.log(
							'Evidence rollback succeeded; newly uploaded Stratus object deleted:',
							storageObjectKey
						);
					} catch (rollbackError) {
						console.error(
							'CRITICAL: Evidence rollback failed; orphaned Stratus object requires manual investigation. StorageObjectKey:',
							storageObjectKey,
							rollbackError
						);
					}

					throw new Error(
						'Evidence metadata registration failed'
					);
				}

				/*
				 * -------------------------------------------------
				 * SUCCESS
				 * -------------------------------------------------
				 */

				console.log(
					'RAW Evidence Registered Successfully'
				);

				console.log(
					'Evidence ROWID:',
					insertedRow.ROWID
				);

				console.log(
					'Evidence CREATEDTIME:',
					insertedRow.CREATEDTIME
				);

				console.log(
					'Evidence UploadedAt:',
					insertedRow.UploadedAt
				);

				return sendJSON(
					res,
					201,
					{
						success: true,

						message:
							'Evidence registered successfully',

						evidence: {
							rowId:
								insertedRow.ROWID,

							caseId:
								fields.caseId,

							fileName:
								uploadedFile.originalFileName,

							mimeType:
								uploadedFile.mimeType,

							fileSize:
								uploadedFile.size,

							sha256:
								sha256,

							storageObjectKey:
								storageObjectKey,

							processingStatus:
								'UPLOADED',

							uploadedAt:
								insertedRow.UploadedAt ||
								uploadedAt,

							createdTime:
								insertedRow.CREATEDTIME ||
								null
						}
					}
				);
			} catch (error) {
				console.error(
					'RAW evidence processing error:',
					error
				);

				return sendJSON(
					res,
					500,
					{
						success: false,

						error:
							error.message ||
							'Evidence registration failed'
					}
				);
			}
		});

		req.pipe(busboy);

	} catch (error) {
		console.error(
			'Evidence endpoint error:',
			error
		);

		return sendJSON(
			res,
			500,
			{
				success: false,
				error:
					error.message ||
					'Internal server error'
			}
		);
	}
};


/*
 * -------------------------------------------------------------
 * SEND JSON RESPONSE
 * -------------------------------------------------------------
 */

function sendJSON(
	res,
	statusCode,
	data
) {
	if (res.writableEnded) {
		return;
	}

	res.writeHead(
		statusCode,
		{
			'Content-Type':
				'application/json'
		}
	);

	res.end(
		JSON.stringify(data)
	);
}


/*
 * -------------------------------------------------------------
 * SANITIZE FILE NAME
 * -------------------------------------------------------------
 */

function sanitizeFileName(fileName) {
	const safeName =
		String(
			fileName ||
			'evidence-file'
		)
			.replace(
				/[^a-zA-Z0-9._-]/g,
				'_'
			)
			.replace(
				/_+/g,
				'_'
			);

	return (
		safeName ||
		'evidence-file'
	);
}


/*
 * -------------------------------------------------------------
 * CATALYST DATETIME
 *
 * Output:
 * YYYY-MM-DD HH:MM:SS
 *
 * Example:
 * 2026-07-22 17:05:42
 * -------------------------------------------------------------
 */

function getCatalystDateTime() {
	const now =
		new Date();

	const pad = (value) =>
		String(value)
			.padStart(2, '0');

	const year =
		now.getFullYear();

	const month =
		pad(
			now.getMonth() + 1
		);

	const day =
		pad(
			now.getDate()
		);

	const hours =
		pad(
			now.getHours()
		);

	const minutes =
		pad(
			now.getMinutes()
		);

	const seconds =
		pad(
			now.getSeconds()
		);

	return (
		`${year}-${month}-${day} ` +
		`${hours}:${minutes}:${seconds}`
	);
}