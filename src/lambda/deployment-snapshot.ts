/*
* This Lambda recieves an event containing a deploymentId.
* It looks for EC2 instances in the current region whose deployment-id tag matches the value specified.
* For all matching EC2 instances, EBS snapshots are created for any data volumes attached to the instance.
* (excluding the root volume).
*
* TODO:
* - Should we copy tags from the source volume to the snapshot?
 */

import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from 'aws-lambda';
import EC2, { Instance, Reservation, InstanceBlockDeviceMapping } from "aws-sdk/clients/ec2";

export async function main(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {

  if (!event.deploymentId) {
    return {
      body: JSON.stringify({message: 'Unsupported event'}),
      statusCode: 500,
    }
  }

  const deploymentId: string = event.deploymentId
  // releaseId can be optionally supplied by the caller
  const releaseId = event.releaseId ? event.releaseId : null
  await snapshotDeploymentInstances(deploymentId, releaseId)

  return {
    body: JSON.stringify({message: 'Successful lambda invocation'}),
    statusCode: 200,
  };
}

async function snapshotDeploymentInstances(deploymentId: string, releaseId: string | null) {

  try {
    const ec2 = new EC2()
    let instances: Instance[] = []

    // Find EC2 instances tagged with our deployment-id, and call snapshot function
    const tagFilter = {
       Filters: [
         { Name: 'tag:deploymentId', Values: [ deploymentId ] }
       ]
    };
    const response = await ec2.describeInstances(tagFilter).promise();
    if (!response.Reservations) {
      console.log('Failed to retrieve EC2 reservations', response);
    } else {
      const reservations : Reservation[] = response.Reservations;
      let reservation: Reservation
      for (reservation of reservations) {
        for (let found_instance of reservation.Instances!){
          instances.push(found_instance)
          console.log('Found instance ' + found_instance.InstanceId + ' for deploymentId ' + deploymentId);
          await snapshotEC2Instance(ec2, found_instance, releaseId);
        }
      }
    }
    if (!instances.length) {
        console.log('No instances found for deploymentId ' + deploymentId);
    }
  } catch (ex: any) { //Remove this 'any' typing for TypeScript < 4.0 (ie customer environment)
    if (ex.code == 'AwsServiceException') {
      console.error('Exception querying AWS: ' + ex);
    } else {
      throw (ex);
    }
  }
}

async function snapshotEC2Instance(ec2_client: EC2, instance: Instance, releaseId: string | null) {

  let block_device_mapping : InstanceBlockDeviceMapping;
  for (let block_device_mapping of instance.BlockDeviceMappings!){
    // Only snapshot data volumes (not root volume)
    if (block_device_mapping.DeviceName == '/dev/xvda') {
      console.log('Skipping root volume at ' + block_device_mapping!.DeviceName +
          " on " + instance.InstanceId!)
    } else {
      console.log('Found data volume ' + block_device_mapping!.Ebs!.VolumeId!,
          "at " + block_device_mapping!.DeviceName + " on " + instance.InstanceId!)

      // We have a releaseId if the Lambda is triggered by step functions as part of a release
      // Otherwise the Lambda was triggered by an API call
      const descriptionString = releaseId ? `Automatic pre-release snapshot for ${releaseId}. Created from ${block_device_mapping!.DeviceName} on ${instance.InstanceId!}.` : `Snapshot triggered by API. Created from ${block_device_mapping!.DeviceName} on ${instance.InstanceId!}.`

      const params = {
        Description: descriptionString,
        VolumeId: block_device_mapping!.Ebs!.VolumeId!
      }
      const output = await ec2_client.createSnapshot(params).promise();
      console.log('createSnapshot id:     ', output.SnapshotId)
      console.log('createSnapshot status: ', output.State)
    }
  }
}