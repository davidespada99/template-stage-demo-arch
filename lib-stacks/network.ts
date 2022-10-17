import { Stack, StackProps, Tags } from "aws-cdk-lib";
import { Vpc, PublicSubnet, PrivateSubnet, CfnInternetGateway, CfnVPCGatewayAttachment, CfnEIP, CfnNatGateway, CfnRoute } from "aws-cdk-lib/aws-ec2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";

export class NetworkStack extends Stack {
    public vpc: Vpc;
    public publicSubnets: PublicSubnet[] = [];
    public privateSubnets: PrivateSubnet[] = [];

    constructor(scope: Construct, id: string, buildConfig: BuildConfig, props: StackProps) {
        super(scope, id, props);

        const prefix = `${buildConfig.environment}-${buildConfig.project}`;

        // VPC
        const vpcName = `${prefix}-vpc`;
        this.vpc = new Vpc(this, vpcName, {
            vpcName: vpcName,
            cidr: buildConfig.stacks.network.vpcCidr,
            enableDnsSupport: true,
            enableDnsHostnames: true,
            natGateways: 0,
            subnetConfiguration: [],
        });
        Tags.of(this.vpc).add("Name", vpcName);

        new StringParameter(this, `${vpcName}-output`, {
            parameterName: vpcName,
            stringValue: this.vpc.vpcId,
        });

        // Subnets
        buildConfig.stacks.network.privateSubnets.forEach((subnet, index) => {
            const privateSubnetName = `${prefix}-private-${subnet.zone}`;
            this.privateSubnets.push(
                new PrivateSubnet(this, privateSubnetName, {
                    vpcId: this.vpc.vpcId,
                    cidrBlock: subnet.cidr,
                    availabilityZone: `${buildConfig.region}${subnet.zone}`,
                    mapPublicIpOnLaunch: false,
                })
            );
            Tags.of(this.privateSubnets[index]).add("Name", privateSubnetName);

            new StringParameter(this, `${privateSubnetName}-output`, {
                parameterName: privateSubnetName,
                stringValue: this.privateSubnets[index].subnetId,
            });
        });

        buildConfig.stacks.network.publicSubnets.forEach((subnet, index) => {
            const publicSubnetName = `${prefix}-public-${subnet.zone}`;
            this.publicSubnets.push(
                new PublicSubnet(this, publicSubnetName, {
                    vpcId: this.vpc.vpcId,
                    cidrBlock: subnet.cidr,
                    availabilityZone: `${buildConfig.region}${subnet.zone}`,
                    mapPublicIpOnLaunch: true,
                })
            );
            Tags.of(this.publicSubnets[index]).add("Name", publicSubnetName);

            new StringParameter(this, `${publicSubnetName}-output`, {
                parameterName: publicSubnetName,
                stringValue: this.publicSubnets[index].subnetId,
            });
        });

        // Internet Gateway
        const internetGatewayName = `${prefix}-igw`;
        const internetGateway = new CfnInternetGateway(this, internetGatewayName, {
            tags: [
                {
                    key: "Name",
                    value: internetGatewayName,
                },
            ],
        });
        const internetGatewayAttachment = new CfnVPCGatewayAttachment(this, `${internetGatewayName}-attachment`, {
            vpcId: this.vpc.vpcId,
            internetGatewayId: internetGateway.ref,
        });

        // NATs
        let natEips: CfnEIP[] = [];
        let natGateways: CfnNatGateway[] = [];

        const natElasticIpName = `${prefix}-nat-eip-${buildConfig.stacks.network.privateSubnets[0].zone}`;
        natEips.push(
            new CfnEIP(this, natElasticIpName, {
                domain: "vpc",
                tags: [
                    {
                        key: "Name",
                        value: natElasticIpName,
                    },
                ],
            })
        );

        const natName = `${prefix}-nat-${buildConfig.stacks.network.privateSubnets[0].zone}`;
        natGateways.push(
            new CfnNatGateway(this, natName, {
                subnetId: this.publicSubnets[0].subnetId,
                allocationId: natEips[0].attrAllocationId,
                tags: [
                    {
                        key: "Name",
                        value: natName,
                    },
                ],
            })
        );

        if (buildConfig.environment == "prod") {
            const secondNatElasticIpName = `${prefix}-nat-eip-${buildConfig.stacks.network.privateSubnets[1].zone}`;
            natEips.push(
                new CfnEIP(this, secondNatElasticIpName, {
                    domain: "vpc",
                    tags: [
                        {
                            key: "Name",
                            value: secondNatElasticIpName,
                        },
                    ],
                })
            );

            const secondNatName = `${prefix}-nat-${buildConfig.stacks.network.privateSubnets[1].zone}`;
            natGateways.push(
                new CfnNatGateway(this, secondNatName, {
                    subnetId: this.publicSubnets[1].subnetId,
                    allocationId: natEips[1].attrAllocationId,
                    tags: [
                        {
                            key: "Name",
                            value: secondNatName,
                        },
                    ],
                })
            );
        }

        // Routes
        let publicRoutes: CfnRoute[] = [];
        buildConfig.stacks.network.publicSubnets.forEach((subnet, index) => {
            const routeName = `${prefix}-public-${subnet.zone}-route`;
            publicRoutes.push(
                new CfnRoute(this, routeName, {
                    routeTableId: this.publicSubnets[index].routeTable.routeTableId,
                    gatewayId: internetGateway.ref,
                    destinationCidrBlock: "0.0.0.0/0",
                })
            );
            Tags.of(publicRoutes[index]).add("Name", routeName);
        });

        let privateRoutes: CfnRoute[] = [];
        buildConfig.stacks.network.privateSubnets.forEach((subnet, index) => {
            const routeName = `${prefix}-private-${subnet.zone}-route`;
            privateRoutes.push(
                new CfnRoute(this, routeName, {
                    routeTableId: this.privateSubnets[index].routeTable.routeTableId,
                    natGatewayId: natGateways[buildConfig.environment == "prod" && index == 1 ? 1 : 0].ref,
                    destinationCidrBlock: "0.0.0.0/0",
                })
            );
            Tags.of(privateRoutes[index]).add("Name", routeName);
        });
    }
}