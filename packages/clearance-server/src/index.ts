import { makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { SESClient } from "@aws-sdk/client-ses";
import { Context, Handler, SQSEvent } from 'aws-lambda';
import type { Subsegment } from 'aws-xray-sdk-core';
import { Pool, PoolConnection, createPool } from 'mysql2/promise';
import { AuthRecord, dbConfig, idempotencyConfig, logger, persistenceStore, tracer } from './config';
import { PaymentService } from './service';

let pool: Pool | null = null;

tracer.captureLambdaHandler({
    captureResponse: true
});

const paymentService: PaymentService = new PaymentService();
const ses = new SESClient({
    region: 'ap-south-1'
});

export const handler: Handler = async (event: SQSEvent, context: Context) => {
    logger.addContext(context);
    logger.info('Received event', { event });

    const getPool = (): Pool => {
        if (!pool) {
            logger.info('Creating new database pool');
            pool = createPool({
                namedPlaceholders: true,
                ...dbConfig
            });
        } else {
            logger.info('Reusing existing database pool');
        }
        return pool;
    };

    let dbConnection: PoolConnection | null = null;

    const segment = tracer.getSegment();
    let handlerSubsegment: Subsegment | undefined;
    if (segment) {
        handlerSubsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
        tracer.setSegment(handlerSubsegment);
    } else {
        logger.error('failed to get segment');
        return { statusCode: 500, body: `Error: Internal Server Error` };
    }

    const record = event.Records[0];

    try {
        const outboxId = record.body;
        logger.info(`Starting processing of ${record.messageId}`)

        const dbPool: Pool = getPool();
        dbConnection = await dbPool.getConnection();
        logger.info('Successfully fetched DB connection');
        await dbConnection.beginTransaction();

        const authRecord: AuthRecord = await paymentService.getAuthRecord(dbConnection, outboxId);

        const [receiverEmail, senderEmail, senderName, accountBalance]: string[] = await paymentService.clearPayment(dbConnection, authRecord);

        await paymentService.sendEmail(ses, receiverEmail, senderEmail, senderName, accountBalance);

        await dbConnection.commit();
        logger.info(`Completed processing of ${record.messageId}`);

        return { statusCode: 200, body: `Successfully processed message: ${record.messageId}` };
    } catch (error: unknown) {
        logger.error('Error occurred', { error });

        if (dbConnection) {
            await dbConnection.rollback();
            logger.warn('Transaction rolled back due to error');
        }

        logger.error(`Error occurred for: ${record.body}`);
        return {
            statusCode: 500,
            body: `Error processing message ${record.messageId}: ${error instanceof Error ? error.stack : error}`
        };
    } finally {
        if (dbConnection) {
            dbConnection.release();
        }

        if (segment && handlerSubsegment) {
            handlerSubsegment.close();
            tracer.setSegment(segment);
        }
    }
};

// export const idempotentHandler = makeIdempotent(handler, {
//     persistenceStore,
//     config: idempotencyConfig
// });
