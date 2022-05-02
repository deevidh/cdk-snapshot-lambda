import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

export class CdkLambdaStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deploymentSnapshotFunction = new NodejsFunction(this, 'deployment-snapshot', {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'main',
      entry: path.join(__dirname, `/../src/lambda/deployment-snapshot.ts`),
    });

    // Allow Lambda function full EC2 access - this could be locked down further
    deploymentSnapshotFunction.addToRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['ec2:*'],
      effect: iam.Effect.ALLOW,
    }));

  }
}