import { Stack, StackProps } from "aws-cdk-lib";
import { AutoScalingGroup} from "aws-cdk-lib/aws-autoscaling";
import { InstanceType, MachineImage, Peer, Port, SecurityGroup, UserData, Vpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";
import { NetworkImportStack } from "./network-import";

export class AsgStack extends Stack {
    public secGroupforASG: SecurityGroup[] = [];
    public autoScalingGroups: AutoScalingGroup[] = [];

    constructor(scope: Construct, id: string, buildConfig: BuildConfig, networkProps: NetworkImportStack ,props?: StackProps) {
        super(scope, id, props);
        const ASGConfig = buildConfig.stacks.autoScalingGroup;

        const prefix = `${buildConfig.environment}-${buildConfig.project}`;
        
        //APPLICATION LOAD BALANCER
        const loadBalancer = new ApplicationLoadBalancer(this, 'TemplateALB', {
            vpc: networkProps.vpc,
            internetFacing: buildConfig.stacks.appLoadBalancer.internetFacing
        });
        //LISTENER
        const listener = loadBalancer.addListener("TemplateALBListener", {
            port: buildConfig.stacks.appLoadBalancer.listenerPort,
            open: buildConfig.stacks.appLoadBalancer.openListenerPort
        });

        //SECURITY GROUP for ALB
        const secGroupALB = new SecurityGroup(this, "SecuriyGroup-for-ALB", {
            vpc: networkProps.vpc
        });
        secGroupALB.addIngressRule(Peer.anyIpv4(), Port.tcp(buildConfig.stacks.appLoadBalancer.listenerPort));

        buildConfig.stacks.autoScalingGroup.forEach((ASGConfig, index) => {

            //AMI
            let ImageAmi;
            let userData;
            if (ASGConfig.os == "windows") {
                ImageAmi = MachineImage.genericWindows({
                    [`${buildConfig.region}`]: ASGConfig.ami,
                });
                userData = UserData.forWindows();

            }
            else if (ASGConfig.os == "linux") {
                ImageAmi = MachineImage.genericLinux({
                    [`${buildConfig.region}`]: ASGConfig.ami,
                });
                userData = UserData.forLinux();
            }
            else {
                ImageAmi = MachineImage.latestAmazonLinux();
                userData = UserData.forLinux();
            }

            if (ASGConfig.userData != null) {
                userData.addCommands(ASGConfig.userData);
            }

            //SECURITY GROUP for ASG
            const secGroup = new SecurityGroup(this, 'SecuriyGroup-for-ASG', {
                vpc: networkProps.vpc,
            });
            secGroup.addIngressRule(Peer.securityGroupId(secGroupALB.securityGroupId), Port.tcp(ASGConfig.securityGroup.numberPort));
            this.secGroupforASG.push(secGroup);

            const asgRoleName = `${prefix}-asg-role`;
            const asgRole = new Role(this, "asgRole", {
                roleName: asgRoleName,
                assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
                managedPolicies:[
                    ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
                ] 
            });

            //AUTO SCALING GROUP
            const asgGroup = new AutoScalingGroup(this, 'TemplateASG', {
                autoScalingGroupName: `ASG-${buildConfig.project}`,
                vpc: networkProps.vpc,
                instanceType: new InstanceType(`${ASGConfig.istanceType.class}.${ASGConfig.istanceType.size}`),
                machineImage: ImageAmi,
                minCapacity: ASGConfig.minCapacity,
                maxCapacity: ASGConfig.maxCapacity,
                desiredCapacity: ASGConfig.desiredCapacity,
                userData: userData,
                securityGroup: secGroup,
                role:asgRole
            });

            //TARGET SCALING CPU
            if (ASGConfig.targetScaling.enable) {
                asgGroup.scaleOnCpuUtilization('TargetUtilizationCPU', {
                    targetUtilizationPercent: ASGConfig.targetScaling.cpuPercent
                });
            }

            //Target Group for ASG to attach to the ALB listener
            if (ASGConfig.targetGroup.attachToALB) {
                listener.addTargets('TemplateTGforASG', {
                    port: buildConfig.stacks.appLoadBalancer.listenerPort,
                    targets: [asgGroup],
                    healthCheck: {
                        enabled: ASGConfig.targetGroup.healthCheck,
                        port: ASGConfig.targetGroup.healtCheckPort,
                        path: ASGConfig.targetGroup.path,
                    }
                });
            }

            this.autoScalingGroups.push(asgGroup);

           
        });
    }
}