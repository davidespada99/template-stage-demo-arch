export interface BuildConfig {
	readonly account: string;
	readonly region: string;
	readonly project: string;
	readonly environment: string;
	readonly version: string;
	readonly stacks: BuildStacks;
}

export interface BuildStacks {
	network: BuildNetworkStack;
}

export interface BuildNetworkStack{
    vpcCidr: string;
    createNetwork?: string;
    publicSubnets?: SubnetsConfig[],
    privateSubnets?: SubnetsConfig[]
}

export interface SubnetsConfig{
    zone: string,
    cidr: string
}
