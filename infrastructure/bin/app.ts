#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { BaseStack } from '../lib/base-stack';
import { EcsStack } from '../lib/ecs-stack';
import { ServerlessStack } from '../lib/serverless-stack';

const app = new cdk.App();

const baseStack = new BaseStack(app, 'BaseStack', {});

const serverlessStack = new ServerlessStack(app, 'ServerlessStack', {
    vpc: baseStack.vpc,
    authorizationDBInstance: baseStack.authorizationDBInstance,
    clearanceSecurityGroup: baseStack.clearanceSecurityGroup
});

const ecsStack = new EcsStack(app, 'EcsStack', {
    vpc: baseStack.vpc,
    pollingQueue: serverlessStack.pollingQueue,
    authorizationDBInstance: baseStack.authorizationDBInstance,
    authSecurityGroup: baseStack.authSecurityGroup,
    authLoadBalancer: baseStack.authLoadBalancer
});

serverlessStack.addDependency(baseStack);
ecsStack.addDependency(baseStack);
ecsStack.addDependency(serverlessStack);