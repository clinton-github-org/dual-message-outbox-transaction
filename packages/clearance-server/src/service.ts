import { SES } from 'aws-sdk';
import { FieldPacket, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Account, AuthRecord, Email, creditAccountSQL, debitAccountSQL, getAccountSQL, getTransactionSQL, logger, tracer } from './config';

export class PaymentService {

    @tracer.captureMethod()
    public async getAuthRecord(dbConnection: PoolConnection, outboxId: string): Promise<AuthRecord> {
        await dbConnection.beginTransaction();
        logger.info('Fetching transaction');

        const [rows, fields]: [RowDataPacket[], FieldPacket[]] = await dbConnection.execute(
            getTransactionSQL,
            [outboxId]
        );

        logger.info('Record fetched from auth table', { rows, fields });

        if (rows.length === 0) {
            throw new Error(`No record found with id: ${outboxId}`);
        }

        return rows[0] as AuthRecord;
    }

    @tracer.captureMethod()
    public async clearPayment(dbConnection: PoolConnection, authRecord: AuthRecord): Promise<string[]> {
        logger.info('Clearance started');

        const [receiver, sender]: Account[] = await this.getAccount(dbConnection, [authRecord.receiver_account_id, authRecord.sender_account_id]);

        const senderAccountBalance = sender.account_balance - authRecord.amount;
        const senderReservedAmount = sender.reserved_amount - authRecord.amount;
        const receiverAccountBalance = receiver.account_balance + authRecord.amount;

        await dbConnection.execute(
            debitAccountSQL,
            [senderAccountBalance, senderReservedAmount, sender.account_number]
        );

        await dbConnection.execute(
            creditAccountSQL,
            [receiverAccountBalance, receiver.account_number]
        );

        logger.info('Clearance successful!');

        return [receiver.phone_number, sender.phone_number, sender.account_name, String(senderAccountBalance)];
    }

    @tracer.captureMethod()
    private async getAccount(dbConnection: PoolConnection, accountNumbers: number[]): Promise<Account[]> {
        logger.info('Fetching Accounts');

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

        logger.info(`Fetched ${accounts.length} Accounts`);

        return accounts;
    }

    @tracer.captureMethod()
    public async sendEmail(ses: SES, receiverEmail: string, senderEmail: string, senderName: string, accountBalance: string) {
        const params: Email = {
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

        const data = await ses.sendEmail(params).promise();
        logger.info('Email sent!: ' + data.MessageId);
    }
}
