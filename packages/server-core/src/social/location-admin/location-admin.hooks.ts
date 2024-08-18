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

import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, iff, isProvider } from 'feathers-hooks-common'

import {
  locationAdminDataValidator,
  locationAdminPatchValidator,
  locationAdminQueryValidator
} from '@etherealengine/common/src/schemas/social/location-admin.schema'
import attachOwnerIdInQuery from '@etherealengine/server-core/src/hooks/set-loggedin-user-in-query'

import verifyScope from '../../hooks/verify-scope'
import {
  locationAdminDataResolver,
  locationAdminExternalResolver,
  locationAdminPatchResolver,
  locationAdminQueryResolver,
  locationAdminResolver
} from './location-admin.resolvers'

export default {
  around: {
    all: [schemaHooks.resolveExternal(locationAdminExternalResolver), schemaHooks.resolveResult(locationAdminResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(locationAdminQueryValidator), schemaHooks.resolveQuery(locationAdminQueryResolver)],
    find: [iff(isProvider('external'), attachOwnerIdInQuery('userId'))],
    get: [disallow('external')],
    create: [
      iff(isProvider('external'), verifyScope('location', 'write')),
      schemaHooks.validateData(locationAdminDataValidator),
      schemaHooks.resolveData(locationAdminDataResolver)
    ],
    update: [disallow()],
    patch: [
      iff(isProvider('external'), verifyScope('location', 'write')),
      schemaHooks.validateData(locationAdminPatchValidator),
      schemaHooks.resolveData(locationAdminPatchResolver)
    ],
    remove: [iff(isProvider('external'), verifyScope('location', 'write'))]
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
