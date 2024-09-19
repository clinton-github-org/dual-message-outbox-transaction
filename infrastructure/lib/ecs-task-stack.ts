import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerDefinition, ContainerImage, FargateTaskDefinition, LogDriver } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService, ScheduledFargateTask } from 'aws-cdk-lib/aws-ecs-patterns';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnDBCluster } from 'aws-cdk-lib/aws-rds';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

interface EcsStackProps extends StackProps {
    vpc: Vpc;
    pollingQueue: Queue;
    sqsPublishPolicy: PolicyStatement;
    rdsCluster: CfnDBCluster;
}

export class EcsTaskStack extends Stack {
    public readonly ecsCluster: Cluster;
    public readonly dbEndpoint: string;

    public readonly authTaskDefinition: FargateTaskDefinition;
    public readonly authorizationContainer: ContainerDefinition;
    public readonly authService: ApplicationLoadBalancedFargateService;

    public readonly pollingTaskDefinition: FargateTaskDefinition;
    public readonly pollingContainer: ContainerDefinition;
    public readonly pollingService: ScheduledFargateTask;

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        this.dbEndpoint = props.rdsCluster.attrEndpointAddress;

        this.ecsCluster = new Cluster(this, 'ecs-cluster', {
            clusterName: 'ecs-cluster',
            vpc: props.vpc,
        });

        // ----------- Authorization: Continuous Service with Load Balancer ------------

        this.authTaskDefinition = new FargateTaskDefinition(this, 'authorization-task-definition', {
            cpu: 256,
            memoryLimitMiB: 1024
        });

        this.authorizationContainer = this.authTaskDefinition.addContainer('auth-container', {
            image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
                file: 'DockerFile.auth'
            }),
            portMappings: [{ containerPort: 8080 }],
            memoryLimitMiB: 512,
            logging: LogDriver.awsLogs({
                streamPrefix: 'auth',
                logGroup: this.createLogGroup('AuthContainerLogGroup', '/ecs/authorization-server')
            }),
            environment: {
                'SPRING_PROFILES_ACTIVE': 'auth',
                'SPRING_DATASOURCE_URL': Fn.join("", [
                    "jdbc:mysql://",
                    this.dbEndpoint!,
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
            assignPublicIp: true,
            taskSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        });

        this.authService.targetGroup.configureHealthCheck({
            path: '/actuator/health',
            interval: Duration.seconds(300),
            timeout: Duration.seconds(20),
        });

        // ----------- Polling: Scheduled Service ------------

        const startPolling = process.env.START_POLLING_TIME || '0 30 23 * * ?';

        this.pollingTaskDefinition = new FargateTaskDefinition(this, 'polling-task-definition', {
            cpu: 256,
            memoryLimitMiB: 1024,
        });

        this.pollingTaskDefinition.addToTaskRolePolicy(props.sqsPublishPolicy);

        this.pollingContainer = this.pollingTaskDefinition.addContainer('polling-container', {
            image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
                file: 'DockerFile.polling',
            }),
            logging: LogDriver.awsLogs({
                streamPrefix: 'polling',
                logGroup: new LogGroup(this, 'PollingContainerLogGroup', {
                    logGroupName: '/ecs/polling-server',
                    retention: RetentionDays.ONE_WEEK,
                }),
            }),
            portMappings: [{ containerPort: 8081 }],
            memoryLimitMiB: 512,
            environment: {
                'SPRING_PROFILES_ACTIVE': 'polling',
                'POLLING_QUEUE_URL': props.pollingQueue.queueUrl,
                'SENDER_EMAIL': process.env.SENDER_EMAIL!,
                'CLUSTER_NAME': this.ecsCluster.clusterName,
                'TASK_ARN': this.pollingTaskDefinition.taskDefinitionArn
            },
        });

        this.pollingService = new ScheduledFargateTask(this, 'polling-service', {
            cluster: this.ecsCluster,
            scheduledFargateTaskDefinitionOptions: {
                taskDefinition: this.pollingTaskDefinition,
            },
            schedule: Schedule.cron({
                minute: startPolling.split(' ')[1],
                hour: startPolling.split(' ')[2],
                day: '*',
                month: '*',
                year: '*',
            }),
            subnetSelection: {
                subnetType: SubnetType.PUBLIC
            }
        });

        new CfnOutput(this, 'LoadBalancerUrl', {
            value: `http://${this.authService.loadBalancer.loadBalancerDnsName}`,
            description: 'The URL of the Application Load Balancer',
        });
    }

    private createLogGroup(id: string, logGroupName: string): LogGroup {
        return new LogGroup(this, id, {
            logGroupName,
            retention: RetentionDays.ONE_DAY,
            removalPolicy: RemovalPolicy.DESTROY
        });
    }
};