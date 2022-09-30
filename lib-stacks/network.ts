import { Stack, StackProps, Tag, Tags } from 'aws-cdk-lib';
import { CfnEIP, CfnInternetGateway, CfnNatGateway, CfnRoute, CfnVPCGatewayAttachment, GatewayVpcEndpointAwsService, PrivateSubnet, PublicSubnet, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { BuildConfig } from '../common_config/build_config';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class NetworkStack extends Stack {

  public vpc: Vpc;
  public publicSubnets: PublicSubnet[] = [];
  public privateSubnets: PrivateSubnet[] = [];

  constructor(scope: Construct, id: string, buildConfig: BuildConfig, props?: StackProps) {
    super(scope, id, props);
    /*  tramite buildconfig prende le info da cdk.json. 
        Il context lo decide quando fa le chiamate da terminare tramite il parametro 'config'
        che può essere 'quality', 'dev', 'prod'
    */

    const prefix = `${buildConfig.environment}-${buildConfig.project}`;

    //VPC
    const vpcName = `${prefix}-vpc`;
    this.vpc = new Vpc(this, vpcName, {
      cidr: buildConfig.stacks.network.vpcCidr,
      vpcName: vpcName,
      natGateways: 0,
      subnetConfiguration: []

    });
    Tags.of(this.vpc).add("Name", vpcName);

    //SUBNETS
    //Public Subnets
    buildConfig.stacks.network.publicSubnets?.forEach((subnet, index) => {
      const publicSubnetName = `${prefix}-public-${subnet.zone}`;
      this.publicSubnets.push(
        new PublicSubnet(this, publicSubnetName, {
          vpcId: this.vpc.vpcId,
          availabilityZone: `${buildConfig.region}${subnet.zone}`,
          cidrBlock: subnet.cidr,
          // assegna ai subnet di questo blocco indirizzi ip pubblici all'avvio in autom.
          mapPublicIpOnLaunch: true
        })
      );
      Tags.of(this.publicSubnets[index]).add("Name", publicSubnetName);

    });

    //Private Subnets
    buildConfig.stacks.network.privateSubnets?.forEach((subnet, index) => {
      const privateSubnetName = `${prefix}-private-${subnet.zone}`;
      this.privateSubnets.push(
        new PrivateSubnet(this, privateSubnetName, {
          vpcId: this.vpc.vpcId,
          availabilityZone: `${buildConfig.region}${subnet.zone}`,
          cidrBlock: subnet.cidr
        })
      );
      Tags.of(this.privateSubnets[index]).add("Name", privateSubnetName);
    })

    //Internet Gateway
    const internetGatewayName = `${prefix}-internet-gateway`;
    const internetGateway = new CfnInternetGateway(this, internetGatewayName, {
      tags: [
        {
          key: "Name",
          value: internetGatewayName
        }
      ]
    });

    //Ora attacco l'Internet Gateway alla vpc
    const igAttachmentName = `${internetGatewayName}-attachment`;
    const internetGatewayAttachment = new CfnVPCGatewayAttachment(this, igAttachmentName, {
      vpcId: this.vpc.vpcId,
      internetGatewayId: internetGateway.ref
    });

    //NAT
    //Per il NAT Gateway mi serve un indirizzo IP elastico
    const natElasticipName = `${prefix}-elastic-ip`;
    const natElasticIP = new CfnEIP(this, natElasticipName, {
      domain: 'vpc',
      tags: [
        {
          key: "Name",
          value: natElasticipName
        }
      ]
    });

    //Ora creo il NAT grazie all'Elastic IP
    const natGatewayName = `${prefix}-gateway-name`;
    const natGateway = new CfnNatGateway(this, natGatewayName, {
      subnetId: this.publicSubnets[0].subnetId,
      allocationId: natElasticIP.attrAllocationId,
      tags: [
        {
          key: "Name",
          value: natGatewayName
        }
      ]
    });


    //ROUTES TABLE
    //Ora creo le routing table per i subnet pubblici e privati

    //RT per Subnet pubblici
    let publicRoutes: CfnRoute[] = []; //creo un array
    buildConfig.stacks.network.publicSubnets?.forEach((subnet, index) => {
      let PublicRouteName = `${prefix}-public-route-${subnet.zone}`;
      publicRoutes.push(
        new CfnRoute(this, PublicRouteName, {
          routeTableId: this.publicSubnets[index].routeTable.routeTableId,
          destinationCidrBlock: "0.0.0.0/0",
          //faccio sì che punti all'internet gateway
          gatewayId: internetGateway.attrInternetGatewayId
        })
      );
    })

    //RT per Subnet privati
    let privateRoutes: CfnRoute[] = [];
    buildConfig.stacks.network.privateSubnets?.forEach((subnet, index) => {
      let PrivateRouteName = `${prefix}-private-route-${subnet.zone}`;
      privateRoutes.push(
        new CfnRoute(this, PrivateRouteName, {
          routeTableId: this.privateSubnets[index].routeTable.routeTableId,
          //faccio sì che punti al nat gateway
          natGatewayId: natGateway.attrNatGatewayId,
          destinationCidrBlock: "0.0.0.0/0"
        })
      );
    })

  }
}
