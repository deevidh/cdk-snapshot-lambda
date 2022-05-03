/*
 * This Lambda recieves an event containing a deploymentId.
 * It looks for EC2 instances in the current region whose deployment-id tag matches the value specified.
 * For all matching EC2 instances, EBS snapshots are created for any data volumes attached to the instance.
 * (excluding the root volume).
 *
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import EC2, { Instance } from "aws-sdk/clients/ec2";

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (!event.deploymentId) {
    return {
      body: JSON.stringify({ message: "Unsupported event" }),
      statusCode: 500,
    };
  }

  const deploymentId = event.deploymentId;
  const releaseId = event.releaseId ? event.releaseId : null; // releaseId can be optionally supplied

  await snapshotDeploymentInstances(deploymentId, releaseId);

  return {
    body: JSON.stringify({ message: "Successful lambda invocation" }),
    statusCode: 200,
  };
}

async function snapshotDeploymentInstances(
  deploymentId: string,
  releaseId: string | null
) {
  try {
    const ec2_client = new EC2();
    let instances: Instance[] = [];

    // Find EC2 instances tagged with our deploymentId, and call snapshot function
    const tagFilter = {
      Filters: [{ Name: "tag:deploymentId", Values: [deploymentId] }],
    };
    const response = await ec2_client.describeInstances(tagFilter).promise();
    if (!response.Reservations) {
      console.log(`Failed to retrieve EC2 reservations ${response}`);
    } else {
      await Promise.all(response.Reservations.map(async (reservation) => {
        await Promise.all(reservation.Instances!.map(async (found_instance) => {
          instances.push(found_instance);
          console.log(
            `${found_instance.InstanceId} - Found instance for deploymentId ${deploymentId}`
          );
          await snapshotEC2Instance(ec2_client, found_instance, releaseId);
        }));
      }));
    }
    if (!instances.length) {
      console.log(`No instances found for deploymentId ${deploymentId}`);
    }
  } catch (ex: any) { //Remove this 'any' typing for TypeScript < 4.0 (ie customer environment)
    if (ex.code == "AwsServiceException") {
      console.error(`Exception querying AWS: ${ex}`);
    } else {
      throw ex;
    }
  }
}

async function snapshotEC2Instance(
  ec2_client: EC2,
  instance: Instance,
  releaseId: string | null
) {
  await Promise.all(instance.BlockDeviceMappings!.map(async (block_device_mapping) => {
    // Only snapshot data volumes (not root volume)
    if (block_device_mapping.DeviceName == '/dev/xvda') {
      console.log(
        `${instance.InstanceId!} - Skipping root volume at ${block_device_mapping!.DeviceName}`
      );
    } else {
      console.log(
        `${instance.InstanceId!} - Creating snapshot for data volume ${block_device_mapping!.Ebs!.VolumeId!}` +
        ` at ${block_device_mapping!.DeviceName}`
      );

      // We have a releaseId if the Lambda is triggered by step functions as part of a release
      // Otherwise the Lambda was triggered by an API call
      const descriptionString = releaseId
        ? `Automatic pre-release snapshot for ${releaseId}. Created from ${
            block_device_mapping!.DeviceName
          } on ${instance.InstanceId!}.`
        : `Snapshot triggered by API. Created from ${
            block_device_mapping!.DeviceName
          } on ${instance.InstanceId!}.`;

      const new_tags = ([] as EC2.Tag[]).concat(
        [
          {
            Key: 'Name',
            Value: releaseId ? `Pre-release snapshot for ${releaseId}` : `API-triggered snapshot for ${instance.InstanceId!}`
          },
          {
            Key: 'created-by',
            Value: 'deploymentsnapshot Lambda function'
          }
        ] as EC2.Tag[]
      ).concat(
        // Copy any tags whose key begins with "maia..." from the instance tags
        instance.Tags!.filter(tag => {
          return tag.Key!.startsWith('maia')
        })
      )

      const params = {
        Description: descriptionString,
        VolumeId: block_device_mapping!.Ebs!.VolumeId!,
        TagSpecifications: [
          {
            ResourceType: 'snapshot',
            Tags: new_tags
          }
        ]
      };

      const snapshot_response = await ec2_client.createSnapshot(params).promise();
      console.log(`${instance.InstanceId!} - Snapshot created ${snapshot_response.SnapshotId!}`)
    }
  }
  ));
}
