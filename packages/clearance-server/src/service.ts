import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { Subsegment } from 'aws-xray-sdk-core';
import { FieldPacket, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Account, AuthRecord, creditAccountSQL, debitAccountSQL, getAccountSQL, getTransactionSQL, setStatus } from './config';

export class PaymentService {

    private readonly logger: Logger;
    private readonly tracer: Tracer;
    public parentSubsegment: Subsegment | null = null;

    constructor(logger: Logger, tracer: Tracer) {
        this.logger = logger;
        this.tracer = tracer;
    }

    public setParentSubSegment(subsegment: Subsegment) {
        this.parentSubsegment = subsegment;
    }

    public async getAuthRecord(dbConnection: PoolConnection, outboxId: string): Promise<AuthRecord> {
        const subsegment: Subsegment = this.parentSubsegment!.addNewSubsegment('### AuthRecord');
        this.tracer.setSegment(subsegment);
        this.logger.info('Fetching transaction');

        const [rows, fields]: [RowDataPacket[], FieldPacket[]] = await dbConnection.execute(
            getTransactionSQL,
            [outboxId]
        );
        this.tracer.addResponseAsMetadata(rows, 'AuthRecord');

        if (rows.length === 0) {
            throw new Error(`No record found with id: ${outboxId}`);
        }

        if (this.parentSubsegment && subsegment) {
            subsegment.close();
            this.tracer.setSegment(this.parentSubsegment);
        }

        return rows[0] as AuthRecord;
    }

    public async clearPayment(dbConnection: PoolConnection, authRecord: AuthRecord): Promise<string[]> {
        const subsegment: Subsegment = this.parentSubsegment!.addNewSubsegment('### ClearPayment');
        this.tracer.setSegment(subsegment);
        try {
            this.logger.info('Clearance started');

            const [receiver, sender]: Account[] = await this.getAccount(dbConnection, [authRecord.receiver_account_id, authRecord.sender_account_id]);
            this.tracer.addResponseAsMetadata([receiver, sender], 'ClearPayment');

            const senderAccountBalance = sender.account_balance - authRecord.amount;
            const senderReservedAmount = sender.reserved_amount - authRecord.amount;
            const receiverAccountBalance = receiver.account_balance + authRecord.amount;

            this.tracer.putAnnotation('senderAccountBalance', senderAccountBalance);
            this.tracer.putAnnotation('senderReservedAmount', senderReservedAmount);
            this.tracer.putAnnotation('receiverAccountBalance', receiverAccountBalance);

            await dbConnection.execute(
                debitAccountSQL,
                [senderAccountBalance, senderReservedAmount, sender.account_number]
            );

            await dbConnection.execute(
                creditAccountSQL,
                [receiverAccountBalance, receiver.account_number]
            );

            await dbConnection.execute(
                setStatus,
                ['COMPLETED', authRecord.outbox_id]
            );

            this.logger.info('Clearance successful!');

            if (this.parentSubsegment && subsegment) {
                subsegment.close();
                this.tracer.setSegment(this.parentSubsegment);
            }

            return [receiver.phone_number, sender.phone_number, sender.account_name, String(senderAccountBalance)];
        } catch (error: unknown) {
            await dbConnection.execute(
                setStatus,
                ['PENDING', authRecord.outbox_id]
            );

            throw error;
        } finally {
            if (this.parentSubsegment && subsegment) {
                subsegment.close();
                this.tracer.setSegment(this.parentSubsegment);
            }
        }
    }

    public async getAccount(dbConnection: PoolConnection, accountNumbers: number[]): Promise<Account[]> {
        const subsegment: Subsegment = this.parentSubsegment!.addNewSubsegment('### Account');
        this.tracer.setSegment(subsegment);
        this.logger.info('Fetching Accounts');

        let accounts: Account[] = [];

        for (let i = 0; i < accountNumbers.length; i++) {
            const [rows, fields]: [RowDataPacket[], FieldPacket[]] = await dbConnection.execute(
                getAccountSQL,
                [accountNumbers[i]]
            );

            if (rows.length === 0) {
                throw new Error(`No account found with id: ${accountNumbers[i]}`);
            }

            accounts[i] = rows[0] as Account;
        }

        this.tracer.addResponseAsMetadata(accounts, 'Account');
        if (this.parentSubsegment && subsegment) {
            subsegment.close();
            this.tracer.setSegment(this.parentSubsegment);
        }

        return accounts;
    }

    public async sendEmail(sesClient: SESClient, receiverEmail: string, senderEmail: string, senderName: string, accountBalance: string) {
        const subsegment: Subsegment = this.parentSubsegment!.addNewSubsegment('### Email');
        this.tracer.setSegment(subsegment);
        this.logger.info('Sending Email');

        const params: SendEmailCommandInput = {
            Source: senderEmail,
            Destination: {
                ToAddresses: [receiverEmail]
            },
            Message: {
                Subject: {
                    Data: 'Payment Done!'
                },
                Body: {
                    Text: {
                        Data: `Hello, ${senderName}\n\nPayment has been successfully completed!\n\nYou have a balance of ${accountBalance}`
                    }
                }
            }
        }

        const data = await sesClient.send(new SendEmailCommand(params));
        this.tracer.addResponseAsMetadata(data, 'Email');
        if (this.parentSubsegment && subsegment) {
            subsegment.close();
            this.tracer.setSegment(this.parentSubsegment);
        }
    }
}
