import { Stack, StackProps } from "aws-cdk-lib";
import { LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import { ServerApplication, ServerDeploymentConfig, ServerDeploymentGroup } from "aws-cdk-lib/aws-codedeploy";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CodeBuildAction, CodeCommitSourceAction, CodeDeployServerDeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";
import { AsgStack } from "./asg";

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, buildConfig: BuildConfig, asgProps: AsgStack, props: StackProps) {
        super(scope, id, props)

        const prefix = `${buildConfig.environment}-${buildConfig.project}`;
        //import existing repository
        const repo = Repository.fromRepositoryName(this, 'importRepo', 'application-arch-1');

        //Pipeline on every AutoScalingGroup
        asgProps.autoScalingGroups.forEach((autoScalingGroup) => {

            const codeBuildrole = new Role(this, `${prefix}-codeBuildRole`, {
                roleName: 'CodeBuildRole',
                assumedBy: new ServicePrincipal("codebuild.amazonaws.com")
            });

            const projectName = `${prefix}-codebuild-proj`;
            const project = new PipelineProject(this, projectName, {
                projectName,
                environment: {
                    buildImage: LinuxBuildImage.STANDARD_5_0,
                    privileged: false
                },
                role: codeBuildrole
            });

            //CodeCommit
            const sourceOutput = new Artifact();
            const sourceAction = new CodeCommitSourceAction({
                actionName: "Codebuild",
                repository: repo,
                branch: "main",
                output: sourceOutput
            });

            //CodeBuild
            const buildOutput = new Artifact();
            const buildAction = new CodeBuildAction({
                actionName: "CodeBuild",
                input: sourceOutput,
                project: project,
                outputs: [buildOutput],
                executeBatchBuild: false,
            });

            //CodeDeploy
            const application = new ServerApplication(this, "CodeDeploy-ServerApplication", {
                applicationName: `${prefix}-CodeDeploy-application`
            });

            const deploymentGroup = new ServerDeploymentGroup(this, "CodeDeployEc2Istances", {
                deploymentGroupName: `${prefix}-deployment-group`,
                application,
                autoScalingGroups: [autoScalingGroup],
                deploymentConfig: ServerDeploymentConfig.ONE_AT_A_TIME
            });


            const artifactBucket = new Bucket(this, 'PipelineS3Bucket,', {
                bucketName: `${prefix}-my-bucket`,
            });

            const deployRole = new Role(this, "DeployRole", {
                assumedBy: new ServicePrincipal("s3.amazonaws.com")
            });

            deployRole.addToPolicy(
                new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject'],
                resources: [`${artifactBucket.bucketArn}/*`],
            })
            );

            const deployAction = new CodeDeployServerDeployAction({
                actionName: "CodeDeploy",
                input: buildOutput,
                deploymentGroup,
                role: deployRole
            })


            const pipeline = new Pipeline(this, "myPipeline", {
                pipelineName: `${prefix}-pipeline`,
                artifactBucket: Bucket.fromBucketAttributes(this, 'ImportedBucket', {
                    bucketName: `${prefix}-my-bucket`,
                }),
                stages: [
                    {
                        stageName: "source",
                        actions: [sourceAction]
                    },
                    {
                        stageName: "build",
                        actions: [buildAction]
                    },
                    {
                        stageName: "deploy",
                        actions: [deployAction]
                    }
                ]
            });

            repo.grantPullPush(pipeline.role);
        });
    }
}