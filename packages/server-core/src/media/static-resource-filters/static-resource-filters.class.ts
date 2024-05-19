import { ServiceInterface } from '@feathersjs/feathers'
import { KnexAdapterParams } from '@feathersjs/knex'
import { Knex } from 'knex'

import {
  StaticResourceFiltersQuery,
  StaticResourceFiltersType
} from '@etherealengine/common/src/schemas/media/static-resource-filters.schema'
import { staticResourcePath, StaticResourceType } from '@etherealengine/common/src/schemas/media/static-resource.schema'

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

import { Application } from '../../../declarations'

export interface StaticResourceFiltersParams extends KnexAdapterParams<StaticResourceFiltersQuery> {}

export class StaticResourceFiltersService
  implements ServiceInterface<StaticResourceFiltersType, StaticResourceFiltersParams>
{
  app: Application

  constructor(app: Application) {
    this.app = app
  }

  async get() {
    const knexClient: Knex = this.app.get('knexClient')

    const mimeTypes = await knexClient
      .select('mimeType')
      .groupBy('mimeType')
      .from<StaticResourceType>(staticResourcePath)

    const filters: StaticResourceFiltersType = { mimeTypes: mimeTypes.map((el) => el.mimeType) }
    return filters
  }
}
