#!/usr/bin/env node
import 'source-map-support/register';
import { App, Stack, Tags } from "aws-cdk-lib";
import { NetworkStack } from '../lib-stacks/network';
import { getConfig } from '../common_config/get_config';
import { EC2Stack } from '../lib-stacks/ec2';
import { RDSStack } from '../lib-stacks/rds';

function addTagsToStack(stack: Stack, name: string): void {
  Tags.of(stack).add("Project", buildConfig.project);
  Tags.of(stack).add("Environment", buildConfig.environment);
}

const app = new App();
const buildConfig = getConfig(app);
const envDetails = {
  account: buildConfig.account,
  region: buildConfig.region
};
const prefix = `${buildConfig.environment}-${buildConfig.project}`;


//NETWORK
const networkStackName = `${prefix}-network`;
let networkStack = new NetworkStack(app, 'NetworkStack', buildConfig, {
  stackName: networkStackName,
  env: envDetails
});
addTagsToStack(networkStack as NetworkStack, networkStackName);


//EC2
const EC2StackName = `${prefix}-ec2`;
let ec2Stack = new EC2Stack(app, 'EC2Stack', buildConfig, networkStack, {
  stackName: EC2StackName,
  env: envDetails,
});
addTagsToStack(ec2Stack as EC2Stack, EC2StackName);

//RDS
const RDSStackName = `${prefix}-rds`;
let rdsStack = new RDSStack(app, 'RDSStack', buildConfig, networkStack, ec2Stack, {
  stackName: RDSStackName,
  env: envDetails
})
