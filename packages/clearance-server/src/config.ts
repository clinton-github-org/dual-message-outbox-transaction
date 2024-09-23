import { IdempotencyConfig } from "@aws-lambda-powertools/idempotency";
import { DynamoDBPersistenceLayer } from "@aws-lambda-powertools/idempotency/dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { PoolOptions } from "mysql2/promise";

const getTransactionSQL: string = 'SELECT * FROM auth WHERE outbox_id = ?';
const getAccountSQL: string = 'SELECT * FROM account WHERE account_number = ?';
const creditAccountSQL: string = 'UPDATE account SET account_balance = ? WHERE account_number = ?';
const debitAccountSQL: string = 'UPDATE account SET account_balance = ?, reserved_amount = ? WHERE account_number = ?';
const setStatus: string = 'UPDATE outbox set status = ? WHERE id = ?';

const dbConfig: PoolOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const persistenceStore = new DynamoDBPersistenceLayer({
    tableName: 'auth-record-idempotency-table',
});
const idempotencyConfig = new IdempotencyConfig({
    throwOnNoIdempotencyKey: true,
    eventKeyJmesPath: 'Records[0].body'
});

const logger: Logger = new Logger({
    serviceName: 'clearance-sever'
});
const tracer: Tracer = new Tracer({
    serviceName: 'clearance-sever'
});

interface AuthRecord {
    id: number;
    amount: number;
    receiver_account_id: number;
    sender_account_id: number;
    timestamp: Date;
    outbox_id: number;
}

interface Account {
    account_number: number;
    account_balance: number;
    account_name: string;
    account_type: string;
    phone_number: string;
    reserved_amount: number;
}

export { Account, AuthRecord, creditAccountSQL, dbConfig, debitAccountSQL, getAccountSQL, getTransactionSQL, idempotencyConfig, logger, persistenceStore, setStatus, tracer };

