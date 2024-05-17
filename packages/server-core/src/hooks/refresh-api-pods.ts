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

import { getState } from '@etherealengine/hyperflux'
import * as k8s from '@kubernetes/client-node'
import logger from '../ServerLogger'
import { ServerState } from '../ServerState'
import config from '../appconfig'

export default async () => {
  const k8AppsClient = getState(ServerState).k8AppsClient

  if (k8AppsClient) {
    try {
      logger.info('Attempting to refresh API pods')
      const refreshApiPodResponse = await k8AppsClient.patchNamespacedDeployment(
        `${config.server.releaseName}-etherealengine-api`,
        'default',
        {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
                }
              }
            }
          }
        },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: {
            'Content-Type': k8s.PatchUtils.PATCH_FORMAT_STRATEGIC_MERGE_PATCH
          }
        }
      )
      logger.info(refreshApiPodResponse, 'updateBuilderTagResponse')
    } catch (e) {
      logger.error(e)
      return e
    }
  }
}
