import fetch from 'node-fetch'
import semver from 'semver'

import {
  helmBuilderVersionPath,
  helmMainVersionPath,
  helmSettingMethods,
  helmSettingPath
} from '@etherealengine/common/src/schemas/setting/helm-setting.schema'

import { Application } from '../../../declarations'
import { updateAppConfig } from '../../updateAppConfig'
import { HelmSettingService } from './helm-setting.class'
import helmSettingDocs from './helm-setting.docs'
import hooks from './helm-setting.hooks'

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

import { BUILDER_CHART_REGEX, MAIN_CHART_REGEX } from '@etherealengine/common/src/regex'

declare module '@etherealengine/common/declarations' {
  interface ServiceTypes {
    [helmSettingPath]: HelmSettingService
    [helmMainVersionPath]: { find: () => Promise<string[]> }
    [helmBuilderVersionPath]: { find: () => Promise<string[]> }
  }
}

export default (app: Application): void => {
  const options = {
    name: helmSettingPath,
    paginate: app.get('paginate'),
    Model: app.get('knexClient'),
    multi: true
  }

  app.use(helmSettingPath, new HelmSettingService(options), {
    // A list of all methods this service exposes externally
    methods: helmSettingMethods,
    // You can add additional custom events to be sent to clients here
    events: [],
    docs: helmSettingDocs
  })

  const service = app.service(helmSettingPath)
  service.hooks(hooks)

  service.on('patched', () => {
    updateAppConfig()
  })

  app.use(helmMainVersionPath, {
    find: async () => {
      const versions: string[] = []
      const response = await fetch('https://helm.etherealengine.org')
      const chart = Buffer.from(await response.arrayBuffer()).toString()

      const matches = chart.matchAll(MAIN_CHART_REGEX)
      for (const match of matches) {
        if (match) {
          //Need 5.1.3 or greater for API servers to have required cluster roles to run helm upgrade
          if (versions.indexOf(match[1]) < 0 && semver.gte(match[1], '5.1.3')) versions.push(match[1])
        }
      }
      return versions
    }
  })

  app.use(helmBuilderVersionPath, {
    find: async () => {
      const versions: string[] = []
      const response = await fetch('https://helm.etherealengine.org')
      const chart = Buffer.from(await response.arrayBuffer()).toString()

      const matches = chart.matchAll(BUILDER_CHART_REGEX)

      for (const match of matches) {
        if (match && versions.indexOf(match[1]) < 0) {
          versions.push(match[1])
        }
      }
      return versions
    }
  })
}
