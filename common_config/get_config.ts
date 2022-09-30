import { App } from "aws-cdk-lib";
import { BuildConfig } from "./build_config";

export function getConfig(app: App): BuildConfig {
	const env = app.node.tryGetContext("config");

	if (!env) throw new Error('Incorrect context variable on CDK command! Pass "config" parameter for example like "-c config=dev"');

	const buildConfig: BuildConfig = app.node.tryGetContext(env);

	if (!buildConfig) throw new Error("Invalid context variable for BuildConfig! Check the compatibility with the interface");
	
	return buildConfig;
}
