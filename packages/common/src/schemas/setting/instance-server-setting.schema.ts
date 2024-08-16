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

// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import type { Static } from '@feathersjs/typebox'
import { getValidator, querySyntax, Type } from '@feathersjs/typebox'

import { dataValidator, queryValidator } from '../validators'

export const instanceServerSettingPath = 'instance-server-setting'

export const instanceServerSettingMethods = ['find', 'get', 'create', 'patch', 'remove'] as const

export const iceServerSchema = Type.Object(
  {
    urls: Type.String() || Type.Array(Type.String()),
    useFixedCredentials: Type.Boolean(),
    useTimeLimitedCredentials: Type.Boolean(),
    username: Type.Optional(Type.String()),
    credential: Type.Optional(Type.String()),
    webRTCStaticAuthSecretKey: Type.Optional(Type.String())
  },
  { $id: 'IceServerSchema', additionalProperties: false }
)

export interface IceServerType extends Static<typeof iceServerSchema> {}

export const webRTCSettingsSchema = Type.Object(
  {
    iceServers: Type.Array(Type.Ref(iceServerSchema)),
    useCustomICEServers: Type.Boolean(),
    usePrivateInstanceserverIP: Type.Boolean()
  },
  { $id: 'webRTCSettingsSchema', additionalProperties: false }
)

export interface webRTCSettingsType extends Static<typeof webRTCSettingsSchema> {}

// Main data model schema
export const instanceServerSettingSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    clientHost: Type.String(),
    rtcStartPort: Type.Integer(),
    rtcEndPort: Type.Integer(),
    rtcPortBlockSize: Type.Integer(),
    identifierDigits: Type.Integer(),
    local: Type.Boolean(),
    domain: Type.String(),
    releaseName: Type.String(),
    port: Type.String(),
    mode: Type.String(),
    locationName: Type.String(),
    webRTCSettings: Type.Ref(webRTCSettingsSchema),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'InstanceServerSetting', additionalProperties: false }
)
export interface InstanceServerSettingType extends Static<typeof instanceServerSettingSchema> {}

// Schema for creating new entries
export const instanceServerSettingDataSchema = Type.Pick(
  instanceServerSettingSchema,
  [
    'clientHost',
    'rtcStartPort',
    'rtcEndPort',
    'rtcPortBlockSize',
    'identifierDigits',
    'local',
    'domain',
    'releaseName',
    'port',
    'mode',
    'locationName',
    'webRTCSettings'
  ],
  {
    $id: 'InstanceServerSettingData'
  }
)
export interface InstanceServerSettingData extends Static<typeof instanceServerSettingDataSchema> {}

// Schema for updating existing entries
export const instanceServerSettingPatchSchema = Type.Partial(instanceServerSettingSchema, {
  $id: 'InstanceServerSettingPatch'
})
export interface InstanceServerSettingPatch extends Static<typeof instanceServerSettingPatchSchema> {}

// Schema for allowed query properties
export const instanceServerSettingQueryProperties = Type.Pick(instanceServerSettingSchema, [
  'id',
  'clientHost',
  'rtcStartPort',
  'rtcEndPort',
  'rtcPortBlockSize',
  'identifierDigits',
  'local',
  'domain',
  'releaseName',
  'port',
  'mode',
  'locationName'
])
export const instanceServerSettingQuerySchema = Type.Intersect(
  [
    querySyntax(instanceServerSettingQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface InstanceServerSettingQuery extends Static<typeof instanceServerSettingQuerySchema> {}

export const iceServerValidator = /* @__PURE__ */ getValidator(iceServerSchema, dataValidator)
export const webRTCSettingsValidator = /* @__PURE__ */ getValidator(webRTCSettingsSchema, dataValidator)
export const instanceServerSettingValidator = /* @__PURE__ */ getValidator(instanceServerSettingSchema, dataValidator)
export const instanceServerSettingDataValidator = /* @__PURE__ */ getValidator(
  instanceServerSettingDataSchema,
  dataValidator
)
export const instanceServerSettingPatchValidator = /* @__PURE__ */ getValidator(
  instanceServerSettingPatchSchema,
  dataValidator
)
export const instanceServerSettingQueryValidator = /* @__PURE__ */ getValidator(
  instanceServerSettingQuerySchema,
  queryValidator
)
