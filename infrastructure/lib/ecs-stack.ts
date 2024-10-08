import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerDefinition, ContainerImage, FargateService, FargateTaskDefinition, LogDriver } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

interface EcsStackProps extends StackProps {
    vpc: Vpc;
    pollingQueue: Queue;
    authorizationDBInstance: DatabaseInstance;
    authSecurityGroup: SecurityGroup;
    authLoadBalancer: ApplicationLoadBalancer;
}

export class EcsStack extends Stack {
    public readonly ecsCluster: Cluster;
    public readonly authTaskDefinition: FargateTaskDefinition;
    public readonly authorizationContainer: ContainerDefinition;
    public readonly authService: ApplicationLoadBalancedFargateService;

    public readonly pollingContainer: ContainerDefinition;
    public readonly pollingService: FargateService;

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        this.ecsCluster = new Cluster(this, 'auth-ecs-cluster', {
            clusterName: 'auth-ecs-cluster',
            vpc: props.vpc,
        });

        // ----------- Authorization: Continuous Service with Load Balancer ------------

        this.authTaskDefinition = new FargateTaskDefinition(this, 'authorization-task-definition', {
            cpu: 256,
            memoryLimitMiB: 2048,
        });
        this.authTaskDefinition.addToTaskRolePolicy(this.allowSESOperations());
        this.authTaskDefinition.addToTaskRolePolicy(this.allowSQSPublish(props.pollingQueue));

        this.authorizationContainer = this.authTaskDefinition.addContainer('auth-container', {
            image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
                file: 'DockerFile.auth'
            }),
            portMappings: [{ containerPort: 8080 }],
            memoryLimitMiB: 1024,
            logging: LogDriver.awsLogs({
                streamPrefix: 'auth',
                logGroup: this.createLogGroup('AuthContainerLogGroup', '/ecs/authorization-server')
            }),
            environment: {
                'SPRING_PROFILES_ACTIVE': 'auth',
                'SPRING_DATASOURCE_URL': Fn.join("", [
                    "jdbc:mysql://",
                    props.authorizationDBInstance.dbInstanceEndpointAddress,
                    `:3306/${props.authorizationDBInstance.instanceIdentifier}`
                ]),
                'SPRING_DATASOURCE_USERNAME': process.env.DB_USERNAME!,
                'SPRING_DATASOURCE_PASSWORD': process.env.DB_PASSWORD!,
                'SPRING_JPA_DATABASE_PLATFORM': 'org.hibernate.dialect.MySQL8Dialect',
                'SPRING_JPA_HIBERNATE_DDL_AUTO': 'update',
                'SPRING_JPA_SHOW_SQL': 'false',
                'SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL': 'true',
                'SENDER_EMAIL': process.env.SENDER_EMAIL!,
                'SERVER_PORT': '8080'
            }
        });

        this.authService = new ApplicationLoadBalancedFargateService(this, 'auth-service', {
            cluster: this.ecsCluster,
            taskDefinition: this.authTaskDefinition,
            desiredCount: 1,
            securityGroups: [props.authSecurityGroup],
            serviceName: 'auth-service',
            loadBalancer: props.authLoadBalancer,
        });

        this.authService.targetGroup.configureHealthCheck({
            path: '/actuator/health',
            interval: Duration.seconds(300),
            timeout: Duration.seconds(20),
        });

        // ----------- Polling: Scheduled Service ------------

        this.pollingContainer = this.authTaskDefinition.addContainer('polling-container', {
            image: ContainerImage.fromAsset(path.join(__dirname, '../../packages/authorization-server'), {
                file: 'DockerFile.polling',
            }),
            logging: LogDriver.awsLogs({
                streamPrefix: 'polling',
                logGroup: this.createLogGroup('PollingContainerLogGroup', '/ecs/polling-server')
            }),
            portMappings: [{ containerPort: 8081 }],
            memoryLimitMiB: 512,
            environment: {
                'SPRING_PROFILES_ACTIVE': 'polling',
                'POLLING_QUEUE_URL': props.pollingQueue.queueUrl,
                'SPRING_DATASOURCE_URL': Fn.join("", [
                    "jdbc:mysql://",
                    props.authorizationDBInstance.dbInstanceEndpointAddress,
                    ":3306/authorization"
                ]),
                'SPRING_DATASOURCE_USERNAME': process.env.DB_USERNAME!,
                'SPRING_DATASOURCE_PASSWORD': process.env.DB_PASSWORD!,
                'SPRING_JPA_DATABASE_PLATFORM': 'org.hibernate.dialect.MySQL8Dialect',
                'SPRING_JPA_HIBERNATE_DDL_AUTO': 'update',
                'SPRING_JPA_SHOW_SQL': 'false',
                'SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL': 'true',
                'SERVER_PORT': '8081'
            },
        });

        this.pollingService = new FargateService(this, 'polling-service', {
            cluster: this.ecsCluster,
            taskDefinition: this.authTaskDefinition,
            desiredCount: 1,
            securityGroups: [props.authSecurityGroup],
            serviceName: 'polling-service'
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

    private allowSESOperations(): PolicyStatement {
        return new PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        })
    }

    private allowSQSPublish(pollingQueue: Queue): PolicyStatement {
        return new PolicyStatement({
            actions: ['sqs:SendMessage'],
            effect: Effect.ALLOW,
            resources: [pollingQueue.queueArn]
        });
    }

    private createSecurityGroup(id: string, securityGroupName: string, description: string, vpc: Vpc): SecurityGroup {
        return new SecurityGroup(this, id, {
            vpc,
            description,
            securityGroupName,
        });
    }
};