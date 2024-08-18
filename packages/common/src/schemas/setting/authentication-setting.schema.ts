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

export const authenticationSettingPath = 'authentication-setting'

export const authenticationSettingMethods = ['find', 'patch'] as const

export const authStrategiesSchema = Type.Object(
  {
    jwt: Type.Optional(Type.Boolean()),
    apple: Type.Optional(Type.Boolean()),
    facebook: Type.Optional(Type.Boolean()),
    github: Type.Optional(Type.Boolean()),
    google: Type.Optional(Type.Boolean()),
    linkedin: Type.Optional(Type.Boolean()),
    twitter: Type.Optional(Type.Boolean()),
    emailMagicLink: Type.Optional(Type.Boolean()),
    smsMagicLink: Type.Optional(Type.Boolean()),
    didWallet: Type.Optional(Type.Boolean())
  },
  { $id: 'AuthStrategies', additionalProperties: false }
)
export interface AuthStrategiesType extends Static<typeof authStrategiesSchema> {}

export const authJwtOptionsSchema = Type.Object(
  {
    expiresIn: Type.String()
  },
  { $id: 'AuthJwtOptions', additionalProperties: false }
)
export interface AuthJwtOptionsType extends Static<typeof authJwtOptionsSchema> {}

export const authBearerTokenSchema = Type.Object(
  {
    numBytes: Type.Number()
  },
  { $id: 'AuthBearerToken', additionalProperties: false }
)
export interface AuthBearerTokenType extends Static<typeof authBearerTokenSchema> {}

export const authCallbackSchema = Type.Object(
  {
    facebook: Type.String(),
    apple: Type.String(),
    github: Type.String(),
    google: Type.String(),
    linkedin: Type.String(),
    twitter: Type.String(),
    discord: Type.String()
  },
  { $id: 'AuthCallback', additionalProperties: false }
)
export interface AuthCallbackType extends Static<typeof authCallbackSchema> {}

export const authDefaultsSchema = Type.Object(
  {
    host: Type.String(),
    protocol: Type.String()
  },
  { $id: 'AuthDefaults', additionalProperties: false }
)
export interface AuthDefaultsType extends Static<typeof authDefaultsSchema> {}

export const authAppCredentialsSchema = Type.Object(
  {
    appId: Type.Optional(Type.String()),
    key: Type.String(),
    secret: Type.String(),
    scope: Type.Optional(Type.Array(Type.String())),
    custom_params: Type.Optional(Type.Record(Type.String(), Type.String()))
  },
  { $id: 'AuthAppCredentials', additionalProperties: false }
)
export interface AuthAppCredentialsType extends Static<typeof authAppCredentialsSchema> {}

export const authOauthSchema = Type.Object(
  {
    defaults: Type.Optional(Type.Ref(authDefaultsSchema)),
    apple: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    facebook: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    github: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    google: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    linkedin: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    twitter: Type.Optional(Type.Ref(authAppCredentialsSchema)),
    discord: Type.Optional(Type.Ref(authAppCredentialsSchema))
  },
  { $id: 'AuthOauth', additionalProperties: false }
)
export interface AuthOauthType extends Static<typeof authOauthSchema> {}

// Main data model schema
export const authenticationSettingSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    service: Type.String(),
    entity: Type.String(),
    secret: Type.String({ maxLength: 4095 }),
    jwtAlgorithm: Type.Optional(Type.String()),
    jwtPublicKey: Type.Optional(Type.String({ maxLength: 1023 })),
    authStrategies: Type.Array(Type.Ref(authStrategiesSchema)),
    jwtOptions: Type.Optional(Type.Ref(authJwtOptionsSchema)),
    bearerToken: Type.Optional(Type.Ref(authBearerTokenSchema)),
    callback: Type.Optional(Type.Ref(authCallbackSchema)),
    oauth: Type.Optional(Type.Ref(authOauthSchema)),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'AuthenticationSetting', additionalProperties: false }
)
export interface AuthenticationSettingType extends Static<typeof authenticationSettingSchema> {}

export interface AuthenticationSettingDatabaseType
  extends Omit<AuthenticationSettingType, 'authStrategies' | 'jwtOptions' | 'bearerToken' | 'callback' | 'oauth'> {
  authStrategies: string
  jwtOptions: string
  bearerToken: string
  callback: string
  oauth: string
}

// Schema for creating new entries
export const authenticationSettingDataSchema = Type.Pick(
  authenticationSettingSchema,
  ['service', 'entity', 'secret', 'authStrategies', 'jwtOptions', 'bearerToken', 'callback', 'oauth'],
  {
    $id: 'AuthenticationSettingData'
  }
)
export interface AuthenticationSettingData extends Static<typeof authenticationSettingDataSchema> {}

// Schema for updating existing entries
export const authenticationSettingPatchSchema = Type.Partial(authenticationSettingSchema, {
  $id: 'AuthenticationSettingPatch'
})
export interface AuthenticationSettingPatch extends Static<typeof authenticationSettingPatchSchema> {}

// Schema for allowed query properties
export const authenticationSettingQueryProperties = Type.Pick(authenticationSettingSchema, [
  'id',
  'service',
  'entity',
  'secret'
  //'authStrategies',  Commented out because: https://discord.com/channels/509848480760725514/1093914405546229840/1095101536121667694
  // 'jwtOptions',
  // 'bearerToken',
  // 'callback',
  // 'oauth'
])
export const authenticationSettingQuerySchema = Type.Intersect(
  [
    querySyntax(authenticationSettingQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface AuthenticationSettingQuery extends Static<typeof authenticationSettingQuerySchema> {}

export const authAppCredentialsValidator = /* @__PURE__ */ getValidator(authAppCredentialsSchema, dataValidator)
export const authBearerTokenValidator = /* @__PURE__ */ getValidator(authBearerTokenSchema, dataValidator)
export const authCallbackValidator = /* @__PURE__ */ getValidator(authCallbackSchema, dataValidator)
export const authDefaultsValidator = /* @__PURE__ */ getValidator(authDefaultsSchema, dataValidator)
export const authJwtOptionsValidator = /* @__PURE__ */ getValidator(authJwtOptionsSchema, dataValidator)
export const authOauthValidator = /* @__PURE__ */ getValidator(authOauthSchema, dataValidator)
export const authStrategiesValidator = /* @__PURE__ */ getValidator(authStrategiesSchema, dataValidator)
export const authenticationSettingValidator = /* @__PURE__ */ getValidator(authenticationSettingSchema, dataValidator)
export const authenticationSettingDataValidator = /* @__PURE__ */ getValidator(
  authenticationSettingDataSchema,
  dataValidator
)
export const authenticationSettingPatchValidator = /* @__PURE__ */ getValidator(
  authenticationSettingPatchSchema,
  dataValidator
)
export const authenticationSettingQueryValidator = /* @__PURE__ */ getValidator(
  authenticationSettingQuerySchema,
  queryValidator
)
