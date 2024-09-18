import { CfnOutput, Duration, Stack, StackProps, aws_ec2 } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerDefinition, ContainerImage, FargateService, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { EcsTask, SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

export class InfrastructureStack extends Stack {
  public vpc: Vpc;
  public readonly ecsCluster: Cluster;
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
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
      ],
    });

    this.snsTopic = new SnsTopic(new Topic(this, 'notification-topic', {
      displayName: 'SMS Notification Topic'
    }), {
      retryAttempts: 1
    });

    this.pollingQueue = new Queue(this, 'polling-queue', {
      queueName: 'polling-queue',
      retentionPeriod: Duration.minutes(60)
    });

    // ----------- Authorization: Continuous Service with Load Balancer ------------

    this.ecsCluster = new Cluster(this, 'authorization-cluster', {
      clusterName: 'authorization-cluster',
      vpc: this.vpc,
    });

    this.authTaskDefinition = new FargateTaskDefinition(this, 'authorization-task-definition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const snsPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: [this.snsTopic.topic.topicArn],
    });

    this.authTaskDefinition.addToTaskRolePolicy(snsPublishPolicy);

    this.authorizationContainer = this.authTaskDefinition.addContainer('auth-container', {
      image: ContainerImage.fromAsset(path.join(__dirname, 'packages/authorization-server'), {
        file: 'DockerFile.auth'
      }),
      memoryLimitMiB: 512,
      environment: {
        'spring.profiles.active': 'auth',
        'NOTIFICATION.TOPIC.ARN': this.snsTopic.topic.topicArn
      }
    });

    this.authService = new ApplicationLoadBalancedFargateService(this, 'auth-service', {
      cluster: this.ecsCluster,
      taskDefinition: this.authTaskDefinition,
      publicLoadBalancer: true,
      desiredCount: 1
    });

    // ----------- Polling: Scheduled Service ------------
    this.pollingRule = new Rule(this, 'polling-rule', {
      schedule: Schedule.expression('cron(0 */5 * ? * ?)')
    });

    this.pollingTaskDefinition = new FargateTaskDefinition(this, 'polling-task-definition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const sqsPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sqs:SendMessage'],
      resources: [this.pollingQueue.queueArn]
    });

    this.pollingTaskDefinition.addToTaskRolePolicy(sqsPublishPolicy);

    this.pollingContainer = this.pollingTaskDefinition.addContainer('polling-container', {
      image: ContainerImage.fromAsset(path.join(__dirname, 'packages/authorization-server'), {
        file: 'DockerFile.polling'
      }),
      memoryLimitMiB: 512,
      environment: {
        'spring.profiles.active': 'polling',
        'POLLING.QUEUE.URL': this.pollingQueue.queueUrl
      }
    });

    this.pollingService = new FargateService(this, 'polling-service', {
      cluster: this.ecsCluster,
      taskDefinition: this.pollingTaskDefinition,
      desiredCount: 0
    });

    this.pollingRule.addTarget(new EcsTask(
      {
        cluster: this.ecsCluster,
        taskDefinition: this.pollingTaskDefinition,
      }
    ));

    new CfnOutput(this, 'LoadBalancerUrl', {
      value: `http://${this.authService.loadBalancer.loadBalancerDnsName}`,
      description: 'The URL of the Application Load Balancer',
    });
  }
}
