/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

import { apiJobPath } from '@etherealengine/common/src/schemas/cluster/api-job.schema'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import { getState } from '@etherealengine/hyperflux'
import * as k8s from '@kubernetes/client-node'
import { Application } from '../declarations'
import { ServerState } from './ServerState'
import config from './appconfig'
import { getPodsData } from './cluster/pods/pods-helper'

export const createExecutorJob = async (
  app: Application,
  jobBody: k8s.V1Job,
  jobLabelSelector: string,
  timeout: number,
  jobId: string,
  waitForFinish = true
) => {
  const k8BatchClient = getState(ServerState).k8BatchClient

  const name = jobBody.metadata!.name!
  try {
    await k8BatchClient.deleteNamespacedJob(name, 'default', undefined, undefined, 0, undefined, 'Background')
  } catch (err) {
    console.log('Old job did not exist, continuing...')
  }

  await k8BatchClient.createNamespacedJob('default', jobBody)
  let counter = 0
  return new Promise((resolve, reject) => {
    if (!waitForFinish) resolve({})
    const interval = setInterval(async () => {
      counter++

      const job = await app.service(apiJobPath).get(jobId)
      console.log('job to be checked on', job, job.status)
      if (job.status !== 'pending') clearInterval(interval)
      if (job.status === 'succeeded') resolve(job.returnData)
      if (job.status === 'failed') reject()
      if (counter >= timeout) {
        clearInterval(interval)
        const date = await getDateTimeSql()
        await app.service(apiJobPath).patch(jobId, {
          status: 'failed',
          endTime: date
        })
        reject('Job timed out; try again later or check error logs of job')
      }
    }, 1000)
  })
}

export async function getJobBody(
  app: Application,
  command: string[],
  name: string,
  labels: { [key: string]: string },
  ttlSecondsAfterFinished = 86400 // This value is 1 day
): Promise<k8s.V1Job> {
  const apiPods = await getPodsData(
    `app.kubernetes.io/instance=${config.server.releaseName},app.kubernetes.io/component=api`,
    'api',
    'Api',
    app
  )

  const image = apiPods.pods[0].containers.find((container) => container.name === 'etherealengine')!.image

  // Add this label to the job so that we can identify pods for a job
  labels['etherealengine/isJob'] = 'true'

  return {
    metadata: {
      name,
      labels
    },
    spec: {
      ttlSecondsAfterFinished,
      template: {
        metadata: {
          labels
        },
        spec: {
          serviceAccountName: `${process.env.RELEASE_NAME}-etherealengine-api`,
          containers: [
            {
              name,
              image,
              imagePullPolicy: 'IfNotPresent',
              command,
              env: Object.entries(process.env).map(([key, value]) => {
                return { name: key, value: value }
              })
            }
          ],
          restartPolicy: 'Never'
        }
      }
    }
  }
}
