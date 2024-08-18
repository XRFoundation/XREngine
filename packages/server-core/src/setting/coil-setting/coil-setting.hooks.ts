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
  coilSettingDataValidator,
  coilSettingPatchValidator,
  coilSettingQueryValidator
} from '@etherealengine/common/src/schemas/setting/coil-setting.schema'

import verifyScope from '../../hooks/verify-scope'
import {
  coilSettingDataResolver,
  coilSettingExternalResolver,
  coilSettingPatchResolver,
  coilSettingQueryResolver,
  coilSettingResolver
} from './coil-setting.resolvers'

export default {
  around: {
    all: [schemaHooks.resolveExternal(coilSettingExternalResolver), schemaHooks.resolveResult(coilSettingResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(coilSettingQueryValidator), schemaHooks.resolveQuery(coilSettingQueryResolver)],
    find: [],
    get: [],
    create: [
      iff(isProvider('external'), verifyScope('admin', 'admin'), verifyScope('settings', 'write')),
      schemaHooks.validateData(coilSettingDataValidator),
      schemaHooks.resolveData(coilSettingDataResolver)
    ],
    update: [iff(isProvider('external'), verifyScope('admin', 'admin'), verifyScope('settings', 'write'))],
    patch: [
      iff(isProvider('external'), verifyScope('admin', 'admin'), verifyScope('settings', 'write')),
      schemaHooks.validateData(coilSettingPatchValidator),
      schemaHooks.resolveData(coilSettingPatchResolver)
    ],
    remove: [iff(isProvider('external'), verifyScope('admin', 'admin'), verifyScope('settings', 'write'))]
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
