import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, ILayerVersion, LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

interface ServerlessStackProps extends StackProps {
    vpc: Vpc,
    authorizationDBInstance: DatabaseInstance,
    clearanceSecurityGroup: SecurityGroup;
}

export class ServerlessStack extends Stack {
    public readonly pollingQueue: Queue;
    public readonly deadLetterQueue: Queue;
    public readonly idempotencyTable: Table;
    public readonly clearanceServer: Function;

    constructor(scope: Construct, id: string, props: ServerlessStackProps) {
        super(scope, id, props);

        this.deadLetterQueue = new Queue(this, 'auth-record-dead-letter-queue', {
            queueName: 'auth-record-dead-letter-queue',
            retentionPeriod: Duration.days(1)
        });

        this.pollingQueue = new Queue(this, 'auth-record-polling-queue', {
            queueName: 'auth-record-polling-queue',
            retentionPeriod: Duration.days(1),
            visibilityTimeout: Duration.minutes(10),
            deliveryDelay: Duration.seconds(15),
            deadLetterQueue: {
                queue: this.deadLetterQueue,
                maxReceiveCount: 2
            }
        });

        this.idempotencyTable = new Table(this, 'auth-record-idempotency-table', {
            tableName: 'auth-record-idempotency-table',
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            timeToLiveAttribute: 'expiration',
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        this.clearanceServer = new Function(this, 'clearance-server', {
            functionName: 'clearance-server',
            code: Code.fromAsset(path.join(__dirname, '../../packages/clearance-server/dist')),
            runtime: Runtime.NODEJS_20_X,
            handler: 'index.handler',
            tracing: Tracing.ACTIVE,
            layers: [this.createPowerToolsLayer()],
            environment: {
                NODE_OPTIONS: '--enable-source-maps',
                DB_HOST: props.authorizationDBInstance.dbInstanceEndpointAddress,
                DB_USERNAME: process.env.DB_USERNAME!,
                DB_PASSWORD: process.env.DB_PASSWORD!,
                DB_NAME: props.authorizationDBInstance.instanceIdentifier,
                POLLING_URL: this.pollingQueue.queueUrl
            },
            logGroup: this.createLogGroup('clearance-server-log-group', '/lambda/clearance-server'),
            timeout: Duration.minutes(5),
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [props.clearanceSecurityGroup],
        });

        this.clearanceServer.addToRolePolicy(this.allowIdempotentTableReadWrite());
        this.clearanceServer.addEventSource(this.createPollingEventSource());
        this.clearanceServer.addToRolePolicy(this.allowSESOperations());
    }

    private createLogGroup(id: string, logGroupName: string): LogGroup {
        return new LogGroup(this, id, {
            logGroupName,
            retention: RetentionDays.ONE_DAY,
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    private createPowerToolsLayer(): ILayerVersion {
        return LayerVersion.fromLayerVersionArn(
            this,
            'PowertoolsLayer',
            `arn:aws:lambda:ap-south-1:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:13`
        );
    }

    private allowIdempotentTableReadWrite(): PolicyStatement {
        return new PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
            effect: Effect.ALLOW,
            resources: [this.idempotencyTable.tableArn],
            sid: 'AllowIdempotentTableReadWrite'
        });
    }

    private allowSESOperations(): PolicyStatement {
        return new PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        })
    }

    private createPollingEventSource(): SqsEventSource {
        return new SqsEventSource(this.pollingQueue, {
            batchSize: 1,
            maxConcurrency: 10
        })
    }
};