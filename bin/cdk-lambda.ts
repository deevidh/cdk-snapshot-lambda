import * as cdk from 'aws-cdk-lib';
import {CdkLambdaStack} from '../lib/cdk-lambda-stack';

const app = new cdk.App();
new CdkLambdaStack(app, 'cdk-lambda-stack', {
  stackName: 'cdk-lambda-stack',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});