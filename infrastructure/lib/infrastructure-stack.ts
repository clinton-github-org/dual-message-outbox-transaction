import { CfnOutput, Duration, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerDefinition, ContainerImage, FargateService, FargateTaskDefinition, LogDriver } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { EcsTask, SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnDBCluster, CfnDBSubnetGroup } from 'aws-cdk-lib/aws-rds';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

export class InfrastructureStack extends Stack {
  public vpc: Vpc;
  public readonly ecsCluster: Cluster;
  public readonly rdsCluster: CfnDBCluster;

  public readonly authTaskDefinition: FargateTaskDefinition;
  public readonly authorizationContainer: ContainerDefinition;
  public readonly snsTopic: SnsTopic;
  public readonly authService: ApplicationLoadBalancedFargateService;

  public readonly pollingRule: Rule;
  public readonly pollingTaskDefinition: FargateTaskDefinition;
  public readonly pollingContainer: ContainerDefinition;
  public readonly pollingService: FargateService;
  public readonly pollingQueue: Queue;

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

    this.snsTopic = new SnsTopic(new Topic(this, 'notification-topic', {
      displayName: 'SMS Notification Topic'
    }), {
      retryAttempts: 1
    });

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

    const dbEndpoint = Fn.getAtt(this.rdsCluster.logicalId, 'Endpoint.Address').toString();

    // ----------- Authorization: Continuous Service with Load Balancer ------------

    this.ecsCluster = new Cluster(this, 'authorization-cluster', {
      clusterName: 'authorization-cluster',
      vpc: this.vpc,
    });

    this.authTaskDefinition = new FargateTaskDefinition(this, 'authorization-task-definition', {
      cpu: 256,
      memoryLimitMiB: 1024
    });

    const snsPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: [this.snsTopic.topic.topicArn],
    });

    this.authTaskDefinition.addToTaskRolePolicy(snsPublishPolicy);

    const authLogGroup = new LogGroup(this, 'AuthContainerLogGroup', {
      logGroupName: '/ecs/authorization-server',
      retention: RetentionDays.ONE_DAY,
    });

    this.authorizationContainer = this.authTaskDefinition.addContainer('auth-container', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
        file: 'DockerFile.auth'
      }),
      portMappings: [{ containerPort: 8080 }],
      memoryLimitMiB: 512,
      logging: LogDriver.awsLogs({
        streamPrefix: 'auth',
        logGroup: authLogGroup
      }),
      environment: {
        'SPRING_PROFILES_ACTIVE': 'auth',
        'NOTIFICATION_TOPIC_ARN': this.snsTopic.topic.topicArn,
        'SPRING_DATASOURCE_URL': Fn.join("", [
          "jdbc:mysql://",
          dbEndpoint,
          ":3306/authorization"
        ]),
        'SPRING_DATASOURCE_USERNAME': process.env.DB_USERNAME!,
        'SPRING_DATASOURCE_PASSWORD': process.env.DB_PASSWORD!,
        'SPRING_JPA_DATABASE_PLATFORM': 'org.hibernate.dialect.MySQL8Dialect',
        'SPRING_JPA_HIBERNATE_DDL_AUTO': 'update',
        'SPRING_JPA_SHOW_SQL': 'false',
        'SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL': 'true'
      }
    });

    this.authService = new ApplicationLoadBalancedFargateService(this, 'auth-service', {
      cluster: this.ecsCluster,
      taskDefinition: this.authTaskDefinition,
      publicLoadBalancer: true,
      desiredCount: 1,
      assignPublicIp: true
    });

    this.authService.targetGroup.configureHealthCheck({
      path: '/actuator/health',
      interval: Duration.seconds(300),
      timeout: Duration.seconds(20),
    });

    // ----------- Polling: Scheduled Service ------------

    this.pollingRule = new Rule(this, 'polling-rule', {
      schedule: Schedule.expression('cron(0 */5 * ? * ?)'),
    });

    this.pollingTaskDefinition = new FargateTaskDefinition(this, 'polling-task-definition', {
      cpu: 256,
      memoryLimitMiB: 1024,
    });

    const sqsPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sqs:SendMessage'],
      resources: [this.pollingQueue.queueArn]
    });

    this.pollingTaskDefinition.addToTaskRolePolicy(sqsPublishPolicy);

    const pollingLogGroup = new LogGroup(this, 'PollingContainerLogGroup', {
      logGroupName: '/ecs/polling-server',
      retention: RetentionDays.ONE_DAY,
    });

    this.pollingContainer = this.pollingTaskDefinition.addContainer('polling-container', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
        file: 'DockerFile.polling'
      }),
      logging: LogDriver.awsLogs({
        streamPrefix: 'polling',
        logGroup: pollingLogGroup
      }),
      portMappings: [{ containerPort: 8081 }],
      memoryLimitMiB: 512,
      environment: {
        'SPRING_PROFILES_ACTIVE': 'polling',
        'POLLING_QUEUE_URL': this.pollingQueue.queueUrl
      }
    });

    this.pollingService = new FargateService(this, 'polling-service', {
      cluster: this.ecsCluster,
      taskDefinition: this.pollingTaskDefinition,
      desiredCount: 0,
      assignPublicIp: true,
    });

    this.pollingRule.addTarget(new EcsTask({
      cluster: this.ecsCluster,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
      taskDefinition: this.pollingTaskDefinition,
      assignPublicIp: true
    }));

    new CfnOutput(this, 'LoadBalancerUrl', {
      value: `http://${this.authService.loadBalancer.loadBalancerDnsName}`,
      description: 'The URL of the Application Load Balancer',
    });
  }
};