import { Stack, StackProps } from "aws-cdk-lib";
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { DatabaseCluster, DatabaseClusterEngine, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";
import { EC2Stack } from "./ec2";
import { NetworkStack } from "./network";

export class RDSStack extends Stack {
    constructor(scope: Construct, id: string, buildConfig: BuildConfig, networkProps: NetworkStack, ec2Props: EC2Stack, props?: StackProps) {
        super(scope, id, props);

        const prefix = `${buildConfig.environment}-${buildConfig.project}`;

        //SECURITY GROUP for RDS
        const securityGroupforRDS = new SecurityGroup(this, "sec_group_rds", {
            securityGroupName: `${prefix}-sec_group_RDS`,
            vpc: networkProps.vpc
        });
        securityGroupforRDS.addIngressRule(Peer.securityGroupId(ec2Props.securityGroupEC2.securityGroupId), Port.tcp(3306));

        //RDS
        const RDSName = `${prefix}-rds`;
        const rdsCluster = new DatabaseInstance(this, RDSName, {
            vpc: networkProps.vpc,
            vpcSubnets: { subnets: networkProps.privateSubnets },
            engine: DatabaseInstanceEngine.mysql({ version: MysqlEngineVersion.VER_8_0_28 }),
            instanceType: InstanceType.of(InstanceClass.M5, InstanceSize.LARGE),
            multiAz: true,
            deletionProtection: false,
            publiclyAccessible: false,
            securityGroups: [securityGroupforRDS]
        });


    }
} 