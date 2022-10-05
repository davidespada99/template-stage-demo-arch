#!/usr/bin/env node
import 'source-map-support/register';
import { App, Stack, Tags } from "aws-cdk-lib";
import { getConfig } from '../common_config/get_config';
import { AsgStack } from '../lib-stacks/asg';
import { DbStack } from '../lib-stacks/db';
import { PipelineStack } from '../lib-stacks/pipeline';

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
const asgStackName = `${prefix}-asg-stack`;
let asgStack = new AsgStack(app, 'asgStack', buildConfig, {
  stackName: asgStackName,
  env: envDetails,
});
addTagsToStack(asgStack as AsgStack, asgStackName);

//Database
const dbStackName = `${prefix}-db-stack`;
let dbStack = new DbStack(app, "DBStack", buildConfig, asgStack, {
  stackName: dbStackName,
  env: envDetails,
});
addTagsToStack(dbStack as DbStack, dbStackName);

//Pipeline
const PipelineStackName = `${prefix}-pipeline-stack`;
let pipelineStack = new PipelineStack(app, "PipelineStack", buildConfig, asgStack, {
  stackName: PipelineStackName,
  env: envDetails
});
addTagsToStack(pipelineStack as PipelineStack, PipelineStackName);