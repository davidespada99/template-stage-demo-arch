import { Stack, StackProps } from "aws-cdk-lib";
import { IVpc, ISubnet, Vpc, PrivateSubnet, PublicSubnet } from "aws-cdk-lib/aws-ec2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";

export class NetworkImportStack extends Stack {
	public vpc: IVpc;
	public privateSubnets: ISubnet[] = [];
	public publicSubnets: ISubnet[] = [];

	constructor(scope: Construct, id: string, buildConfig: BuildConfig, props: StackProps) {
		super(scope, id, props);

		const prefix = `${buildConfig.environment}-${buildConfig.project}`;

		const vpcName = `${prefix}-vpc`;
		const vpdId = StringParameter.valueFromLookup(this, vpcName);
		this.vpc = Vpc.fromLookup(this, vpcName, {
			vpcId: vpdId,
			region: buildConfig.region,
		});

		let importedPrivateSubnetsIDs: string[] = [];
		buildConfig.stacks.network.privateSubnets.forEach((subnet) => {
			const subnetName = `${prefix}-private-${subnet.zone}`;
			importedPrivateSubnetsIDs.push(StringParameter.valueFromLookup(this, subnetName));
		});
		importedPrivateSubnetsIDs.forEach((id, index) => {
			this.privateSubnets.push(
				PrivateSubnet.fromSubnetAttributes(this, `${prefix}-private-${index}`, {
					subnetId: id,
					availabilityZone: `${buildConfig.region}${buildConfig.stacks.network.privateSubnets[index].zone}`,
				})
			);
		});

		const importedPublicSubnetsIDs: string[] = [];
		buildConfig.stacks.network.publicSubnets.forEach((subnet) => {
			const subnetName = `${prefix}-public-${subnet.zone}`;
			importedPublicSubnetsIDs.push(StringParameter.valueFromLookup(this, subnetName));
		});
		importedPublicSubnetsIDs.forEach((id, index) => {
			this.publicSubnets.push(
				PublicSubnet.fromSubnetAttributes(this, `${prefix}-public-${index}`, {
					subnetId: id,
					availabilityZone: `${buildConfig.region}${buildConfig.stacks.network.privateSubnets[index].zone}`,
				})
			);
		});
	}
}