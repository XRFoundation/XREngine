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
import { iff, isProvider } from 'feathers-hooks-common'

import {
  spawnPointDataValidator,
  spawnPointQueryValidator
} from '@etherealengine/common/src/schemas/world/spawn-point.schema'

import { createSkippableHooks } from '../../hooks/createSkippableHooks'
import enableClientPagination from '../../hooks/enable-client-pagination'
import projectPermissionAuthenticate from '../../hooks/project-permission-authenticate'
import verifyScope from '../../hooks/verify-scope'
import {
  spawnPointDataResolver,
  spawnPointExternalResolver,
  spawnPointQueryResolver,
  spawnPointResolver
} from './spawn-point.resolvers'

export default createSkippableHooks(
  {
    around: {
      all: [schemaHooks.resolveExternal(spawnPointExternalResolver), schemaHooks.resolveResult(spawnPointResolver)]
    },
    before: {
      all: [schemaHooks.validateQuery(spawnPointQueryValidator), schemaHooks.resolveQuery(spawnPointQueryResolver)],
      find: [enableClientPagination()],
      get: [],
      create: [
        iff(isProvider('external'), verifyScope('editor', 'write'), projectPermissionAuthenticate(false)),
        schemaHooks.validateData(spawnPointDataValidator),
        schemaHooks.resolveData(spawnPointDataResolver)
      ],
      update: [
        iff(isProvider('external'), verifyScope('editor', 'write'), projectPermissionAuthenticate(false)),
        schemaHooks.validateData(spawnPointDataValidator),
        schemaHooks.resolveData(spawnPointDataResolver)
      ],
      patch: [
        iff(isProvider('external'), verifyScope('editor', 'write'), projectPermissionAuthenticate(false)),
        schemaHooks.validateData(spawnPointDataValidator),
        schemaHooks.resolveData(spawnPointDataResolver)
      ],
      remove: [iff(isProvider('external'), verifyScope('editor', 'write'), projectPermissionAuthenticate(false))]
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
  },
  ['find']
)
