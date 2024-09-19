#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { BaseStack } from '../lib/base-stack';
import { EcsTaskStack } from '../lib/ecs-task-stack';

const app = new cdk.App();
const baseStack = new BaseStack(app, 'BaseStack', {
});

const ecsTaskStack = new EcsTaskStack(app, 'EcsTaskStack', {
    vpc: baseStack.vpc,
    pollingQueue: baseStack.pollingQueue,
    sqsPublishPolicy: baseStack.sqsPublishPolicy,
    dbEndpoint: baseStack.dbEndpoint,
});