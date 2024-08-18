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

import setLoggedInUserInData from '@etherealengine/server-core/src/hooks/set-loggedin-user-in-body'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { iff, iffElse, isProvider } from 'feathers-hooks-common'

import {
  projectSettingDataValidator,
  projectSettingPatchValidator,
  projectSettingQueryValidator
} from '@etherealengine/common/src/schemas/setting/project-setting.schema'

import verifyScope from '@etherealengine/server-core/src/hooks/verify-scope'
import checkScope from '../../hooks/check-scope'
import setInContext from '../../hooks/set-in-context'
import verifyProjectPermission from '../../hooks/verify-project-permission'
import {
  projectSettingDataResolver,
  projectSettingExternalResolver,
  projectSettingPatchResolver,
  projectSettingQueryResolver,
  projectSettingResolver
} from './project-setting.resolvers'

export default {
  around: {
    all: [
      schemaHooks.resolveExternal(projectSettingExternalResolver),
      schemaHooks.resolveResult(projectSettingResolver)
    ]
  },

  before: {
    all: [
      schemaHooks.validateQuery(projectSettingQueryValidator),
      schemaHooks.resolveQuery(projectSettingQueryResolver)
    ],
    find: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('projects', 'read'),
          [],
          [
            iffElse(
              checkScope('editor', 'write'),
              verifyProjectPermission(['owner', 'editor', 'reviewer']),
              setInContext('type', 'public')
            ) as any
          ]
        )
      )
    ],
    get: [],
    create: [
      setLoggedInUserInData('userId'),
      schemaHooks.validateData(projectSettingDataValidator),
      schemaHooks.resolveData(projectSettingDataResolver),
      iff(
        isProvider('external'),
        iffElse(
          checkScope('projects', 'write'),
          [],
          [verifyScope('editor', 'write'), verifyProjectPermission(['owner'])]
        )
      )
    ],
    patch: [
      setLoggedInUserInData('userId'),
      schemaHooks.validateData(projectSettingPatchValidator),
      schemaHooks.resolveData(projectSettingPatchResolver),
      iff(
        isProvider('external'),
        iffElse(
          checkScope('projects', 'write'),
          [],
          [verifyScope('editor', 'write'), verifyProjectPermission(['owner', 'editor'])]
        )
      )
    ],
    update: [],
    remove: [
      iff(
        isProvider('external'),
        iffElse(
          checkScope('projects', 'write'),
          [],
          [verifyScope('editor', 'write'), verifyProjectPermission(['owner'])]
        )
      )
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
