#!/usr/bin/env node
import 'source-map-support/register';
import { App, Stack, Tags } from "aws-cdk-lib";
import { getConfig } from '../common_config/get_config';
import { AsgStack } from '../lib-stacks/asg';
import { DbStack } from '../lib-stacks/db';
import { PipelineStack } from '../lib-stacks/pipeline';
import { NetworkStack } from '../lib-stacks/network';
import { NetworkImportStack } from '../lib-stacks/network-import';

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

//network
const networkStackName = `${prefix}-network-stack`;
const networkStack = new NetworkStack(app, networkStackName, buildConfig,{
  stackName:networkStackName,
  env: envDetails,
})

const netImportName = `${prefix}-netImport-stack`;
const netImportStack = new NetworkImportStack(app, netImportName, buildConfig,{
  stackName:netImportName,
  env: envDetails,
})
//ASG
const asgStackName = `${prefix}-asg-stack`;
let asgStack = new AsgStack(app, asgStackName, buildConfig, netImportStack, {
  stackName: asgStackName,
  env: envDetails,
});
addTagsToStack(asgStack as AsgStack, asgStackName);

//Database
const dbStackName = `${prefix}-db-stack`;
let dbStack = new DbStack(app, dbStackName, buildConfig,netImportStack, asgStack, {
  stackName: dbStackName,
  env: envDetails,
});
addTagsToStack(dbStack as DbStack, dbStackName);

//Pipeline
const PipelineStackName = `${prefix}-pipeline-stack`;
let pipelineStack = new PipelineStack(app, PipelineStackName, buildConfig, asgStack, {
  stackName: PipelineStackName,
  env: envDetails
});
addTagsToStack(pipelineStack as PipelineStack, PipelineStackName);