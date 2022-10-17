import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Artifacts, BuildSpec, LinuxBuildImage, PipelineProject, Project } from "aws-cdk-lib/aws-codebuild";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import { ServerApplication, ServerDeploymentConfig, ServerDeploymentGroup } from "aws-cdk-lib/aws-codedeploy";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CodeBuildAction, CodeCommitSourceAction, CodeDeployServerDeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
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

        //Bucket s3
        const s3Bucket = new Bucket(this, 'PipeS3Bucket,', {
            bucketName: `${prefix}-s3-bucket`,
            removalPolicy: RemovalPolicy.DESTROY
        });


        //Pipeline on every AutoScalingGroup
        asgProps.autoScalingGroups.forEach((autoScalingGroup) => {

            //CodeCommit
            const sourceOutput = new Artifact();
            const sourceAction = new CodeCommitSourceAction({
                actionName: `${prefix}-CodeCommit`,
                repository: repo,
                branch: "main",
                output: sourceOutput
            });

            const codeBuildRoleName = `${prefix}-build-role`;
            const codeBuildrole = new Role(this, `${prefix}-codeBuildRole`, {
                roleName: codeBuildRoleName,
                assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
                managedPolicies:[
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodePipelineFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AutoScalingFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployRoleForECS"),
                ]

            });

            /*const projectName = `${prefix}-codebuild-proj`;
            const project = new PipelineProject(this, projectName, {
                projectName: projectName,
                environment: {
                    buildImage: LinuxBuildImage.STANDARD_5_0,
                    privileged: false
                },
                role: codeBuildrole
            });*/

            const projectName = `${prefix}-codebuild-proj`;
            const project = new Project(this, 'MyProject', {
                projectName: projectName,
                buildSpec: BuildSpec.fromObject({
                  version: '0.2',
                }),
                artifacts: Artifacts.s3({
                    bucket: s3Bucket,
                    includeBuildId: false,
                    packageZip: true,
                    path: "dev-arch-1-pipeline/Artifact_b",
                    identifier: 'BuildArtifact1',
                    encryption: false
                  }),
                  role: codeBuildrole
              });

            //CodeBuild
            const buildOutput = new Artifact();
            const buildAction = new CodeBuildAction({
                actionName: `${prefix}-CodeBuild`,
                input: sourceOutput,
                project: project,
                outputs: [buildOutput],
                executeBatchBuild: false,
            });

            //CodeDeploy
            const application = new ServerApplication(this, "CodeDeploy-ServerApplication", {
                applicationName: `${prefix}-CodeDeploy-application`
            });

            

            const deployRoleName = `${prefix}-deploy-role`;
            const deployRole = new Role(this, "DeployRole", {
                roleName: deployRoleName,
                assumedBy: new ServicePrincipal("codedeploy.amazonaws.com"),
                managedPolicies:[
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodePipelineFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AutoScalingFullAccess"),
                    ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployRoleForECS"),
                    ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")

                ] 
            });


            const deploymentGroup = new ServerDeploymentGroup(this, "CodeDeployEc2Istances", {
                deploymentGroupName: `${prefix}-deployment-group`,
                application: application,
                autoScalingGroups: [autoScalingGroup],
                deploymentConfig: ServerDeploymentConfig.ONE_AT_A_TIME,
                role: deployRole
            });



            const deployAction = new CodeDeployServerDeployAction({
                actionName:`${prefix}-CodeDeploy`,
                input: buildOutput,
                deploymentGroup: deploymentGroup,

            });

            
            const pipeline = new Pipeline(this, "myPipeline", {
                pipelineName: `${prefix}-pipeline`,
                artifactBucket: Bucket.fromBucketAttributes(this, 'ImportedBucket', {
                    bucketName: `${prefix}-s3-bucket`}),
                
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
            pipeline.node.addDependency(s3Bucket);
            repo.grantPullPush(pipeline.role);
        });
    }
}