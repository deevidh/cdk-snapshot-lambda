# cdk-snapshot-lambda

## Summary

A simple CDK application written in TypeScript. It describes a Lambda function (and suitable IAM role & policy) which looks up EC2 instances which are tagged with a specific value of "deployment-id" and creates EBS snapshots of and data volumes attached to the instances.

 The CDK infra code was derived from: https://bobbyhadz.com/blog/aws-cdk-typescript-lambda

## How to deploy the CDK app

1. Clone this repository
1. Run `npm install` to install required packages
1. Configure your local environment with suitable AWS credentials
1. Run `npx aws-cdk bootstrap` to configure your AWS environment for CDK
1. Run `npx aws-cdk deploy`

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## How to use the Lambda function

1. In the AWS Console, browse to _Lambda_ -> _Functions_ and select the function starting `cdk-lambda-stack.....`
1. Click _Test_ -> _Configure test event_
1. For the event payload, pass JSON containing a `deploymentId` and optionally a `releaseId`:

     ```json
     {
       "deploymentId": "foobar",
       "releaseId": "r1344423"
     }
     ```

1. Give the test event a name and save it
1. Click the _Test_ button
1. The console output should tell you the success of the invocation. Note: no snapshot will be created unless your AWS account contains an EC2 instance tagged with `deploymentId: foobar` which has multiple EBS volumes attached.
