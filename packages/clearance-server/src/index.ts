import { makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { SESClient } from "@aws-sdk/client-ses";
import { Context, Handler, SQSEvent } from 'aws-lambda';
import { Subsegment } from 'aws-xray-sdk-core';
import { Pool, PoolConnection, createPool } from 'mysql2/promise';
import { AuthRecord, dbConfig, idempotencyConfig, persistenceStore, } from './config';
import { PaymentService } from './service';

let pool: Pool | null = null;

const logger: Logger = new Logger({
    serviceName: 'clearance-sever',
});
const tracer: Tracer = new Tracer({
    serviceName: 'clearance-sever',
    captureHTTPsRequests: true,
    enabled: true
});
const segment = tracer.getSegment();
tracer.annotateColdStart();
tracer.addServiceNameAnnotation();

const paymentService: PaymentService = new PaymentService(logger, tracer);
const sesClient = new SESClient({
    region: 'ap-south-1',
});

export const handler: Handler = makeIdempotent(
    async (event: SQSEvent, context: Context) => {
        let subsegment: Subsegment | undefined;
        if (segment) {
            subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
            tracer.setSegment(subsegment);
        }
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

        const record = event.Records[0];

        try {
            const outboxId = record.body;
            logger.info(`Starting processing of ${record.messageId}`)

            const dbPool: Pool = getPool();
            dbConnection = await dbPool.getConnection();
            await dbConnection.beginTransaction();

            const authRecord: AuthRecord = await paymentService.getAuthRecord(dbConnection, outboxId);

            const [receiverEmail, senderEmail, senderName, accountBalance]: string[] = await paymentService.clearPayment(dbConnection, authRecord);

            await paymentService.sendEmail(sesClient, receiverEmail, senderEmail, senderName, accountBalance);

            await dbConnection.commit();
            logger.info(`Completed processing of ${record.messageId}`);
            tracer.addResponseAsMetadata(`Successfully processed message: ${record.messageId}`, process.env._HANDLER);
        } catch (error: unknown) {
            logger.error('Error occurred', { error });

            if (dbConnection) {
                await dbConnection.rollback();

                logger.warn('Transaction rolled back due to error');
            }

            logger.error(`Error occurred for: ${record.body}`);
            tracer.addErrorAsMetadata(error as Error);
            throw new Error(error instanceof Error ? error.message : `Error with record: ${record}`);
        } finally {
            if (dbConnection) {
                dbConnection.release();
            }

            if (segment && subsegment) {
                subsegment.close();
                tracer.setSegment(segment);
            }
        }
    }, {
    persistenceStore,
    config: idempotencyConfig
});