import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class BaseStack extends Stack {
  public vpc: Vpc;
  public readonly authorizationDBInstance: DatabaseInstance;
  public readonly authorizationDBSecurityGroup: SecurityGroup;
  public readonly clearanceSecurityGroup: SecurityGroup;
  public readonly authSecurityGroup: SecurityGroup;
  public readonly authLoadBalancer: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
      throw new Error('DB creds not found');
    } else if (!process.env.SENDER_EMAIL) {
      throw new Error('SENDER_EMAIL not found');
    }

    this.vpc = new Vpc(this, 'authorization-vpc', {
      maxAzs: 2,
      natGateways: 1,
      createInternetGateway: false,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'authorization-public-subnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'authorization-private-subnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    this.authorizationDBSecurityGroup = this.createSecurityGroup('authorization-db-security-group', 'authorization-db-security-group', 'Authorization DB Security Group', this.vpc);

    this.authorizationDBInstance = new DatabaseInstance(this, 'authorization-db-instance', {
      engine: DatabaseInstanceEngine.mysql({ version: MysqlEngineVersion.VER_8_0_35 }),
      vpc: this.vpc,
      instanceType: InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.MICRO),
      allocatedStorage: 20,  
      databaseName: 'authorization',
      backupRetention: Duration.days(0),
      removalPolicy: RemovalPolicy.DESTROY,
      securityGroups: [this.authorizationDBSecurityGroup],
      instanceIdentifier: 'authorization',
    });

    this.clearanceSecurityGroup = this.createSecurityGroup('clearance-security-group', 'clearance-security-group', 'Clearance Security Group', this.vpc);
    this.authorizationDBSecurityGroup.addIngressRule(this.clearanceSecurityGroup, Port.tcp(3306), 'Allow clearance server to access RDS');
    this.authSecurityGroup = this.createSecurityGroup('auth-security-group', 'auth-security-group', 'Security Group for Authorization server', this.vpc);
    this.authorizationDBSecurityGroup.addIngressRule(this.authSecurityGroup, Port.tcp(3306), 'Allow auth server to access RDS');

    this.authLoadBalancer = new ApplicationLoadBalancer(this, 'auth-load-balancer', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: 'auth-load-balancer',
      securityGroup: this.authSecurityGroup
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