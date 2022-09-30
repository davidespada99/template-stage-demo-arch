import { Stack, StackProps } from "aws-cdk-lib";
import { Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Peer, Port, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition, TargetType } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { InstanceIdTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";
import { NetworkStack } from "./network";

export class EC2Stack extends Stack {
    public ec2: Instance;
    public appLoadBalancer: ApplicationLoadBalancer;
    public securityGroupEC2: SecurityGroup;

    constructor(scope: Construct, id: string, buildConfig: BuildConfig, networkProps: NetworkStack, props?: StackProps) {
        super(scope, id, props)

        const prefix = `${buildConfig.environment}-${buildConfig.project}`;

        //SECURITY GROUPS
        //Security group for ALB
        const securityGroupALB = new SecurityGroup(this, "sec_group_ALB", {
            securityGroupName: `${prefix}-sec_group_ALB`,
            vpc: networkProps.vpc
        });
        //aggiungo una Inbound rule
        securityGroupALB.addIngressRule(Peer.anyIpv4(), Port.tcp(80))

        //Security group for EC2
        this.securityGroupEC2 = new SecurityGroup(this, "sec_group_EC2", {
            securityGroupName: `${prefix}-sec_group_EC2`,
            vpc: networkProps.vpc
        });
        //aggiungo una Inbound rule
        this.securityGroupEC2.addIngressRule(Peer.securityGroupId(securityGroupALB.securityGroupId), Port.tcp(3000));

        //EC2
        const EC2Name = `${prefix}-ec2-${buildConfig.project}`;
        this.ec2 = new Instance(this, EC2Name, {
            vpc: networkProps.vpc, //asseganto al vpc
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO), //tipo istanza t2.micro
            machineImage: MachineImage.latestAmazonLinux(), //OS Amazon Linux
            vpcSubnets: { subnets: [networkProps.privateSubnets[0]] }, //assegnata ai subnet privati
            //availabilityZone: `${buildConfig.region}a`,
            securityGroup: this.securityGroupEC2 //aggiungo la security group all'ec2
        });


        //Application Load Balancer (ALB)
        this.appLoadBalancer = new ApplicationLoadBalancer(this, "loadBalancer", {
            vpc: networkProps.vpc,
            internetFacing: true,
            vpcSubnets: { subnets: networkProps.publicSubnets },
            securityGroup: securityGroupALB //aggiungo la security group al load balancer
        });


        //TARGET GROUP (for ALB)
        const targetGroup = new ApplicationTargetGroup(this, "targetGroup", {
            targetType: TargetType.INSTANCE,
            port: 80,
            vpc: networkProps.vpc,
            targets: [new InstanceIdTarget(this.ec2.instanceId, 80)]
        });

        const listener = this.appLoadBalancer.addListener("HttpListener", {
            port: 80,
            open: true,
            defaultTargetGroups: [targetGroup],
        });


        listener.addAction('/static', {
            priority: 5,
            conditions: [ListenerCondition.pathPatterns(['/*'])],
            action: ListenerAction.forward([targetGroup]) //collega ALB con targetGroup tramite il Listener
        });

    }
}