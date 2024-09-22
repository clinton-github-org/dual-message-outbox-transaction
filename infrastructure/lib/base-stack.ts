import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Peer, Port, SecurityGroup, SubnetType, Vpc, VpcEndpoint, VpcEndpointType } from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnDBCluster, CfnDBSubnetGroup } from 'aws-cdk-lib/aws-rds';
import { Service } from 'aws-cdk-lib/aws-servicediscovery';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

export class BaseStack extends Stack {
  public vpc: Vpc;
  public readonly rdsCluster: CfnDBCluster;
  public readonly pollingQueue: Queue;
  public readonly deadLetterQueue: Queue;
  public readonly sqsPublishPolicy: PolicyStatement;
  public readonly idempotencyTable: Table;
  public readonly clearanceServer: Function;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, 'payment-vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC,

        },
      ],
    });

    const auroraSecurityGroup = new SecurityGroup(this, 'aurora-security-group', { vpc: this.vpc });
    auroraSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(3306), 'Allow MySQL access');

    this.deadLetterQueue = new Queue(this, 'dead-letter-queue', {
      queueName: 'dead-letter-queue',
      retentionPeriod: Duration.days(1)
    });

    this.pollingQueue = new Queue(this, 'polling-queue', {
      queueName: 'polling-queue',
      retentionPeriod: Duration.minutes(60),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 1
      }
    });

    this.rdsCluster = new CfnDBCluster(this, 'payment-db-cluster', {
      engine: 'aurora-mysql',
      engineMode: 'serverless',
      databaseName: 'authorization',
      masterUsername: process.env.DB_USERNAME!,
      masterUserPassword: process.env.DB_PASSWORD!,
      scalingConfiguration: {
        autoPause: true,
        minCapacity: 2,
        maxCapacity: 2,
        secondsUntilAutoPause: 300,
      },
      vpcSecurityGroupIds: [auroraSecurityGroup.securityGroupId],
      dbSubnetGroupName: new CfnDBSubnetGroup(this, 'aurora-subnet-group', {
        dbSubnetGroupDescription: 'Subnet group for Aurora DB',
        subnetIds: this.vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }).subnetIds,
      }).ref,
    });

    this.sqsPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sqs:SendMessage'],
      resources: [this.pollingQueue.queueArn]
    });

    this.idempotencyTable = new Table(this, 'idempotencyTable', {
      tableName: 'idempotencyTable',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: 'expiration',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'PowertoolsLayer',
      `arn:aws:lambda:ap-south-1:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:13`
    );

    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
      throw new Error('DB creds not found');
    }

    const clearanceLogGroup = new LogGroup(this, id, {
      logGroupName: 'clearance-server',
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaSecurityGroup = new SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
    });

    auroraSecurityGroup.addIngressRule(lambdaSecurityGroup, Port.tcp(3306), 'Allow Lambda to access RDS');

    this.clearanceServer = new Function(this, 'clearance-server', {
      functionName: 'clearance-server',
      code: Code.fromAsset(path.join(__dirname, '../../packages/clearance-server/dist')),
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      tracing: Tracing.ACTIVE,
      layers: [powertoolsLayer],
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DB_HOST: this.rdsCluster.attrEndpointAddress,
        DB_USERNAME: process.env.DB_USERNAME!,
        DB_PASSWORD: process.env.DB_PASSWORD!,
        DB_NAME: 'authorization'
      },
      logGroup: clearanceLogGroup,
      timeout: Duration.minutes(2),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC
      },
      securityGroups: [lambdaSecurityGroup],
      allowPublicSubnet: true
    });

    this.idempotencyTable.grantReadWriteData(this.clearanceServer);

    const sqsEventSource = new SqsEventSource(this.pollingQueue, {
      batchSize: 1
    });

    this.clearanceServer.addEventSource(sqsEventSource);

    const sesSendEmailPolicy = new PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    });

    this.clearanceServer.addToRolePolicy(sesSendEmailPolicy);
  }
};