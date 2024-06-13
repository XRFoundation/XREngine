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
import { BadRequest, Forbidden, NotFound } from '@feathersjs/errors'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, discardQuery, iff, iffElse, isProvider } from 'feathers-hooks-common'

import {
  staticResourceDataValidator,
  staticResourcePatchValidator,
  staticResourcePath,
  staticResourceQueryValidator
} from '@etherealengine/common/src/schemas/media/static-resource.schema'
import collectAnalytics from '@etherealengine/server-core/src/hooks/collect-analytics'

import { HookContext } from '../../../declarations'
import checkScope from '../../hooks/check-scope'
import resolveProjectId from '../../hooks/resolve-project-id'
import setLoggedinUserInBody from '../../hooks/set-loggedin-user-in-body'
import verifyProjectPermission from '../../hooks/verify-project-permission'
import verifyScope from '../../hooks/verify-scope'
import { getStorageProvider } from '../storageprovider/storageprovider'
import { StaticResourceService } from './static-resource.class'
import {
  staticResourceDataResolver,
  staticResourceExternalResolver,
  staticResourcePatchResolver,
  staticResourceQueryResolver,
  staticResourceResolver
} from './static-resource.resolvers'

/**
 * Ensure static-resource with the specified id exists and user is creator of the resource
 * @param context
 * @returns
 */
const ensureResource = async (context: HookContext<StaticResourceService>) => {
  const resource = await context.app.service(staticResourcePath).get(context.id!)

  if (!resource.userId) {
    if (context.params?.provider) await verifyScope('admin', 'admin')(context as any)
  } else if (context.params?.provider && resource.userId !== context.params?.user?.id)
    throw new Forbidden('You are not the creator of this resource')

  if (resource.key) {
    const storageProvider = getStorageProvider()
    await storageProvider.deleteResources([resource.key])
  }
}

/**
 * Gets the name of the project to which the resource belongs
 * @param context
 * @returns
 */
const getProjectName = async (context: HookContext<StaticResourceService>) => {
  if (!context.id) {
    throw new BadRequest('Static Resource id missing in the request')
  }
  const resource = await context.app.service(staticResourcePath).get(context.id)
  if (!resource) {
    throw new NotFound('resource not found.')
  }
  context.params.query = {
    ...context.params.query,
    project: resource.project
  }
  return context
}

export default {
  around: {
    all: [
      schemaHooks.resolveExternal(staticResourceExternalResolver),
      schemaHooks.resolveResult(staticResourceResolver)
    ]
  },

  before: {
    all: [
      () => schemaHooks.validateQuery(staticResourceQueryValidator),
      schemaHooks.resolveQuery(staticResourceQueryResolver)
    ],
    find: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('static_resource', 'read'),
          [],
          [verifyScope('editor', 'write'), resolveProjectId(), verifyProjectPermission(['owner', 'editor', 'reviewer'])]
        )
      ),
      discardQuery('action', 'projectId'),
      collectAnalytics()
    ],
    get: [disallow('external')],
    create: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('static_resource', 'write'),
          [],
          [verifyScope('editor', 'write'), resolveProjectId(), verifyProjectPermission(['owner', 'editor'])]
        )
      ),
      setLoggedinUserInBody('userId'),
      () => schemaHooks.validateData(staticResourceDataValidator),
      schemaHooks.resolveData(staticResourceDataResolver)
    ],
    update: [disallow()],
    patch: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('static_resource', 'write'),
          [],
          [verifyScope('editor', 'write'), resolveProjectId(), verifyProjectPermission(['owner', 'editor'])]
        )
      ),
      () => schemaHooks.validateData(staticResourcePatchValidator),
      schemaHooks.resolveData(staticResourcePatchResolver)
    ],
    remove: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('static_resource', 'write'),
          [],
          [
            verifyScope('editor', 'write'),
            getProjectName,
            resolveProjectId(),
            verifyProjectPermission(['owner', 'editor'])
          ]
        )
      ),
      discardQuery('projectId'),
      ensureResource
    ]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as any
