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

import { BadRequest } from '@feathersjs/errors'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, iff, isProvider } from 'feathers-hooks-common'

import {
  ScopeData,
  scopeDataValidator,
  ScopeID,
  scopePath,
  scopeQueryValidator,
  ScopeTypeInterface
} from '@etherealengine/common/src/schemas/scope/scope.schema'

import { HookContext } from '../../../declarations'
import enableClientPagination from '../../hooks/enable-client-pagination'
import verifyScope from '../../hooks/verify-scope'
import verifyScopeAllowingSelf from '../../hooks/verify-scope-allowing-self'
import { ScopeService } from './scope.class'
import { scopeDataResolver, scopeExternalResolver, scopeQueryResolver, scopeResolver } from './scope.resolvers'

/**
 * Check and maintain existing scopes
 * @param context
 * @returns
 */
const checkExistingScopes = async (context: HookContext<ScopeService>) => {
  if (!context.data || context.method !== 'create') {
    throw new BadRequest(`${context.path} service only works for data in ${context.method}`)
  }

  const data: ScopeData[] = Array.isArray(context.data) ? context.data : [context.data]

  // TODO: Make this generic so that even if request contains different user ids, it should work
  const oldScopes = (await context.app.service(scopePath).find({
    query: { userId: data[0].userId },
    paginate: false
  })) as any as ScopeTypeInterface[]

  const existingData: ScopeID[] = []

  for (const item of data) {
    const existingScope = oldScopes && oldScopes.find((el) => el.type === item.type)
    if (existingScope) existingData.push(existingScope.id)
  }

  await context.app.service(scopePath).remove(null, {
    query: {
      id: {
        $in: existingData
      },
      userId: data[0].userId
    }
  })
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(scopeExternalResolver), schemaHooks.resolveResult(scopeResolver)]
  },
  before: {
    all: [schemaHooks.validateQuery(scopeQueryValidator), schemaHooks.resolveQuery(scopeQueryResolver)],
    find: [iff(isProvider('external'), verifyScopeAllowingSelf('user', 'read')), enableClientPagination()],
    get: [iff(isProvider('external'), verifyScopeAllowingSelf('user', 'read'))],
    create: [
      iff(isProvider('external'), verifyScope('user', 'write'), verifyScope('admin', 'admin')),
      schemaHooks.validateData(scopeDataValidator),
      schemaHooks.resolveData(scopeDataResolver),
      checkExistingScopes
    ],
    update: [disallow()],
    patch: [disallow()],
    remove: [iff(isProvider('external'), verifyScope('user', 'write'), verifyScope('admin', 'admin'))]
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
