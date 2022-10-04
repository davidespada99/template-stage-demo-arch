#!/usr/bin/env node
import 'source-map-support/register';
import { App, Stack, Tags } from "aws-cdk-lib";
import { getConfig } from '../common_config/get_config';
import { AsgStack } from '../lib-stacks/asg';
import { DbStack } from '../lib-stacks/db';

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


//ASG
const asgStackName = `${prefix}-asg`;
let asgStack = new AsgStack(app, 'asgStack', buildConfig, {
  stackName: asgStackName,
  env: envDetails,
});
addTagsToStack(asgStack as AsgStack, asgStackName);

//Database
const dbStackName = `${prefix}-db`;
let dbStack = new DbStack(app, "DBStack", buildConfig, asgStack, {
  stackName: dbStackName,
  env: envDetails,
});
addTagsToStack(dbStack as AsgStack, dbStackName);