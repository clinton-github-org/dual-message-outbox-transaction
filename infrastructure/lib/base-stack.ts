import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnDBCluster, CfnDBSubnetGroup } from 'aws-cdk-lib/aws-rds';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

export class BaseStack extends Stack {
  public vpc: Vpc;
  public readonly rdsCluster: CfnDBCluster;
  public readonly pollingQueue: Queue;
  public readonly sqsPublishPolicy: PolicyStatement;

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

    this.pollingQueue = new Queue(this, 'polling-queue', {
      queueName: 'polling-queue',
      retentionPeriod: Duration.minutes(60)
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
  }
};