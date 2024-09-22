import { makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { Handler, SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import type { Subsegment } from 'aws-xray-sdk-core';
import { Pool, PoolConnection, createPool } from 'mysql2/promise';
import { AuthRecord, dbConfig, idempotencyConfig, logger, persistenceStore, tracer } from './config';
import { PaymentService } from './service';

let pool: Pool | null = null;
const getPool = (): Pool => {
    if (!pool) {
        logger.info('Creating new database pool');
        pool = createPool({
            namedPlaceholders: true,
            ...dbConfig,
        });
    } else {
        logger.info('Reusing existing database pool');
    }
    return pool;
};

tracer.captureLambdaHandler({
    captureResponse: true
});

const paymentService: PaymentService = new PaymentService();

AWS.config.update({
    region: 'ap-south-1',
});
const ses = new AWS.SES();

export const handler: Handler = async (event: SQSEvent) => {
    logger.info('Received event', { event });

    const dbPool: Pool = getPool();
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

    logger.info(`Starting batch processing of ${event.Records}`)
    await Promise.all(event.Records.map(async (record) => {
        try {
            const outboxId = record.body;
            logger.info(`Starting processing of ${record.messageId}`)

            dbConnection = await dbPool.getConnection();

            const authRecord: AuthRecord = await paymentService.getAuthRecord(dbConnection, outboxId);

            const [receiverEmail, senderEmail, senderName, accountBalance]: string[] = await paymentService.clearPayment(dbConnection, authRecord);

            await paymentService.sendEmail(ses, receiverEmail, senderEmail, senderName, accountBalance);

            logger.info(`Completed processing of ${record.messageId}`)
        } catch (error: unknown) {
            logger.error('Error occurred', { error });

            if (dbConnection) {
                await dbConnection.rollback();
                logger.warn('Transaction rolled back due to error');
            }

            logger.error(`Error occurred for: ${record.body}`);
            return {
                itemIdentifier: record.messageId
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
    }));
    logger.info(`Completed batch processing of ${event.Records}`)
    return null;
};

export const idempotentHandler = makeIdempotent(handler, {
    persistenceStore,
    config: idempotencyConfig
});
