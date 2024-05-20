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

import * as k8s from '@kubernetes/client-node'

import { objectToArgs } from '@etherealengine/common/src/utils/objectToCommandLineArgs'
import { ModelTransformParameters } from '@etherealengine/engine/src/assets/classes/ModelTransform'

import { Application } from '../../../declarations'
import config from '../../appconfig'
import { getPodsData } from '../../cluster/pods/pods-helper'

export async function getModelTransformJobBody(
  app: Application,
  createParams: ModelTransformParameters
): Promise<k8s.V1Job> {
  const apiPods = await getPodsData(
    `app.kubernetes.io/instance=${config.server.releaseName},app.kubernetes.io/component=api`,
    'api',
    'Api',
    app
  )
  const image = apiPods.pods[0].containers.find((container) => container.name === 'etherealengine')!.image

  const command = [
    'npx',
    'cross-env',
    'ts-node',
    '--swc',
    'packages/server-core/src/assets/model-transform/model-transform.job.ts',
    ...objectToArgs(createParams)
  ]

  return {
    metadata: {
      name: `${process.env.RELEASE_NAME}-${createParams.src}-${createParams.dst}-transform`,
      labels: {
        'etherealengine/modelTransformer': 'true',
        'etherealengine/transformSource': createParams.src,
        'etherealengine/transformDestination': createParams.dst,
        'etherealengine/release': process.env.RELEASE_NAME!
      }
    },
    spec: {
      template: {
        metadata: {
          labels: {
            'etherealengine/modelTransformer': 'true',
            'etherealengine/transformSource': createParams.src,
            'etherealengine/transformDestination': createParams.dst,
            'etherealengine/release': process.env.RELEASE_NAME!
          }
        },
        spec: {
          serviceAccountName: `${process.env.RELEASE_NAME}-etherealengine-api`,
          containers: [
            {
              name: `${process.env.RELEASE_NAME}-${createParams.src}-${createParams.dst}-transform`,
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
