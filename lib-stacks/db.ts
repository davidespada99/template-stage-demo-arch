import { Stack, StackProps } from "aws-cdk-lib";
import { InstanceType, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { DatabaseInstance, DatabaseInstanceEngine, MariaDbEngineVersion, MysqlEngineVersion, PostgresEngineVersion } from "aws-cdk-lib/aws-rds";
import { DH_UNABLE_TO_CHECK_GENERATOR } from "constants";
import { Construct } from "constructs";
import { BuildConfig } from "../common_config/build_config";
import { AsgStack } from "./asg";

export class DbStack extends Stack {
    constructor(scope: Construct, id: string, buildConfig: BuildConfig, asgProps: AsgStack, props?: StackProps) {
        super(scope, id, props);

        //VPC from Lookup
        const myVpc = Vpc.fromLookup(this, 'TemplateVPC', {
            vpcId: buildConfig.stacks.network.vpcId,
            isDefault: false
        });


        buildConfig.stacks.dataBase.forEach((DBConfig, index) => {
            //DATABASE ENGINE 
            let dbEngine;
            if (DBConfig.engine == "mysql") {
                dbEngine = DatabaseInstanceEngine.mysql({
                    version: MysqlEngineVersion.of(DBConfig.fullVersion, DBConfig.majorVersion)
                });
            }
            else if (DBConfig.engine == "postgres") {
                dbEngine = DatabaseInstanceEngine.postgres({
                    version: PostgresEngineVersion.of(DBConfig.fullVersion, DBConfig.majorVersion)
                })
            }
            else if (DBConfig.engine == "mariaDb") {
                dbEngine = DatabaseInstanceEngine.mariaDb({
                    version: MariaDbEngineVersion.of(DBConfig.fullVersion, DBConfig.majorVersion)
                })
            }
            //Default Postgres 14.3 Engine
            else {
                dbEngine = DatabaseInstanceEngine.postgres({
                    version: PostgresEngineVersion.of('14.3', '14')
                })
            }

             //SECURITY GROUP for RDS
            asgProps.secGroupforASG.forEach((secGroup) => {
                const securityGroupforRDS = new SecurityGroup(this, "SecuriyGroup-for-db", {
                    vpc: myVpc
                });
                securityGroupforRDS.addIngressRule(Peer.securityGroupId(secGroup.securityGroupId), Port.tcp(DBConfig.securityGroup.numberPort));
            });
        

            const db = new DatabaseInstance(this, 'DatabaseTemplate', {
                vpc: myVpc,
                engine: dbEngine,
                instanceType: new InstanceType(`${DBConfig.istanceDBType.class}.${DBConfig.istanceDBType.size}`),
                allocatedStorage: DBConfig.allocatedStorage,
                multiAz: DBConfig.multiAz,
                deletionProtection: DBConfig.deletionProtection,
                securityGroups: asgProps.secGroupforASG,
                publiclyAccessible: DBConfig.publiclyAccessible
            });

        })

    }
}
