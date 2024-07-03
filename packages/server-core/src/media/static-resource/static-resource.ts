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

import {
  StaticResourceType,
  staticResourceMethods,
  staticResourcePath
} from '@etherealengine/common/src/schemas/media/static-resource.schema'

import {
  ScopeType,
  UserID,
  projectPath,
  projectPermissionPath,
  scopePath
} from '@etherealengine/common/src/schema.type.module'
import { Paginated } from '@feathersjs/feathers'
import _ from 'lodash'
import { Application } from '../../../declarations'
import { StaticResourceService } from './static-resource.class'
import staticResourceDocs from './static-resource.docs'
import hooks from './static-resource.hooks'

declare module '@etherealengine/common/declarations' {
  interface ServiceTypes {
    [staticResourcePath]: StaticResourceService
  }
}

export default (app: Application): void => {
  const options = {
    name: staticResourcePath,
    paginate: app.get('paginate'),
    Model: app.get('knexClient'),
    multi: true
  }

  app.use(staticResourcePath, new StaticResourceService(options), {
    // A list of all methods this service exposes externally
    methods: staticResourceMethods,
    // You can add additional custom events to be sent to clients here
    events: [],
    docs: staticResourceDocs
  })

  const service = app.service(staticResourcePath)
  service.hooks(hooks)

  const onCRUD =
    (app: Application) => async (data: StaticResourceType | Paginated<StaticResourceType> | StaticResourceType[]) => {
      const projectNames: string[] = []
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item.project && item.type === 'scene') {
            projectNames.push(item.project)
          }
        })
      } else if ('data' in data) {
        data.data.forEach((item) => {
          if (item.project && item.type === 'scene') {
            projectNames.push(item.project)
          }
        })
      } else if (data.project && data.type === 'scene') {
        projectNames.push(data.project)
      }

      const projects = await app.service(projectPath).find({
        query: {
          name: { $in: projectNames },
          $select: ['id']
        },
        paginate: false
      })

      const targetIds: string[] = []
      for (const project of projects) {
        const projectOwners = await app.service(projectPermissionPath).find({
          query: {
            projectId: project.id,
            type: 'owner'
          },
          paginate: false
        })
        projectOwners.forEach((permission) => {
          targetIds.push(permission.userId)
        })
      }

      const projectReadScopes = await app.service(scopePath).find({
        query: {
          type: 'projects:read' as ScopeType
        },
        paginate: false
      })

      projectReadScopes.forEach((scope) => {
        targetIds.push(scope.userId)
      })

      const uniqueUserIds = _.uniq(targetIds)
      return Promise.all(uniqueUserIds.map((userId: UserID) => app.channel(`userIds/${userId}`).send(data)))
    }

  service.publish('created', onCRUD(app))
  service.publish('patched', onCRUD(app))
  service.publish('updated', onCRUD(app))
  service.publish('removed', onCRUD(app))
}
