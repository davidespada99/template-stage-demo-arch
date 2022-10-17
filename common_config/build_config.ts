export interface BuildConfig {
	readonly account: string;
	readonly region: string;
	readonly project: string;
	readonly environment: string;
	readonly stacks: BuildStacks;
}

export interface BuildStacks {
	network: BuildNetworkStack;
	autoScalingGroup: BuildASGStack[];
	appLoadBalancer: BuildALBStack;
	dataBase: BuildDB[];
}

export interface BuildNetworkStack {
    vpcCidr: string;
    privateSubnets: SubnetConfig[];
    publicSubnets: SubnetConfig[];
}
export interface SubnetConfig {
    zone: string;
    cidr: string;
    id: string;
}

export interface BuildASGStack {			//ASG
	os: string,
	ami: string,
	userData: string,
	istanceType: InstanceConfig;
	minCapacity: number;
	maxCapacity: number;
	desiredCapacity: number;
	targetScaling: targetScalingConfig;
	securityGroup: SGConfig;
	targetGroup: TargetGroupConfig;
}

export interface BuildDB {					//Database
	engine: string;
	majorVersion: string;
	fullVersion: string;
	allocatedStorage: number;
	multiAz: boolean;
	istanceDBType: IstanceDBConfig;
	deletionProtection: boolean;
	publiclyAccessible: boolean;
	securityGroup: SecGroupDbConfig;
}

export interface IstanceDBConfig {
	class: string;
	size: string;
}

export interface SecGroupDbConfig{
	numberPort: number;
}

export interface targetScalingConfig {
	enable: boolean;
	cpuPercent: number;
}
export interface TargetGroupConfig {
	attachToALB: boolean
	healthCheck: boolean;
	healtCheckPort: string;
	path: string
}

export interface BuildALBStack {			//ALB
	internetFacing: boolean;
	listenerPort: number;
	openListenerPort: boolean;
	listenerTargetPort: number;

}

export interface SubnetsConfig {
	zone: string,
	cidr: string
}
export interface InstanceConfig {
	class: string;
	size: string;
}

export interface ALBConfig {
	internetFacing: boolean;
	listenerPort: number;
	openListenerPort: boolean;
	listenerTargetPort: number;
}

export interface SGConfig {
	peer: string;
	typePort: string;
	numberPort: number;
}

