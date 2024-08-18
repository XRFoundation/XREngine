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

import { BadRequest, Forbidden, MethodNotAllowed, NotFound } from '@feathersjs/errors'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, iff, isProvider } from 'feathers-hooks-common'
import { random } from 'lodash'

import { isDev } from '@etherealengine/common/src/config'
import { staticResourcePath } from '@etherealengine/common/src/schemas/media/static-resource.schema'
import { scopeTypePath } from '@etherealengine/common/src/schemas/scope/scope-type.schema'
import { scopePath, ScopeType } from '@etherealengine/common/src/schemas/scope/scope.schema'
import { avatarPath } from '@etherealengine/common/src/schemas/user/avatar.schema'
import {
  IdentityProviderData,
  identityProviderDataValidator,
  identityProviderPatchValidator,
  identityProviderPath,
  identityProviderQueryValidator,
  IdentityProviderType
} from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import { UserID, userPath } from '@etherealengine/common/src/schemas/user/user.schema'
import { checkScope } from '@etherealengine/spatial/src/common/functions/checkScope'

import {
  projectPath,
  projectPermissionPath,
  userApiKeyPath,
  UserApiKeyType,
  UserType
} from '@etherealengine/common/src/schema.type.module'
import { Paginated } from '@feathersjs/feathers'
import { HookContext } from '../../../declarations'
import appConfig from '../../appconfig'
import persistData from '../../hooks/persist-data'
import setLoggedinUserInQuery from '../../hooks/set-loggedin-user-in-query'
import { IdentityProviderService } from './identity-provider.class'
import {
  identityProviderDataResolver,
  identityProviderExternalResolver,
  identityProviderPatchResolver,
  identityProviderQueryResolver,
  identityProviderResolver
} from './identity-provider.resolvers'

async function checkTokenAuth(context: HookContext<IdentityProviderService>, userId: UserID): Promise<boolean> {
  const authHeader = context.params.headers?.authorization
  if (authHeader) {
    let authSplit
    if (authHeader) {
      authSplit = authHeader.split(' ')
    }

    if (authSplit && authSplit.length > 1 && authSplit[1]) {
      const key = (await context.app.service(userApiKeyPath).find({
        query: {
          token: authSplit[1]
        }
      })) as Paginated<UserApiKeyType>

      if (key.data.length > 0) {
        const user = await context.app.service(userPath).get(key.data[0].userId)
        if (userId && userId !== user.id) throw new BadRequest('Cannot make identity-providers on other users')
        else return true
      }
    }
  }
  return false
}

/**
 * If trying to CRUD multiple identity-providers (e.g. patch all IP's belonging to a user),
 * make `params.query.userId` the ID of the calling user, so no one can alter anyone else's IPs.
 */
async function checkIdentityProvider(context: HookContext<IdentityProviderService>): Promise<HookContext> {
  if (context.id) {
    const thisIdentityProvider = await context.app.service(identityProviderPath).get(context.id)
    if (
      !context.params.user ||
      !thisIdentityProvider ||
      (context.params.user && thisIdentityProvider && context.params.user.id !== thisIdentityProvider.userId)
    )
      throw new Forbidden('Authenticated user is not owner of this identity provider')
  } else {
    const userId = context.params[identityProviderPath]?.userId
    if (!userId) {
      let isAuthenticated = await checkTokenAuth(context, userId)
      if (!isAuthenticated) {
        if (context.params.authentication) {
          try {
            await context.app.service('authentication').strategies.jwt.authenticate!(
              { accessToken: context.params.authentication.accessToken },
              {}
            )
          } catch (err) {
            throw new NotFound()
          }
        } else throw new NotFound()
      }
    }
    if (!context.params.query) context.params.query = {}
    context.params.query.userId = userId
  }
  return context
}

/**
 * do not allow to remove the identity providers in bulk
 * and we want to disallow removing the last identity provider for non-guest users
 */
async function checkOnlyIdentityProvider(context: HookContext<IdentityProviderService>) {
  if (!context.id) {
    throw new MethodNotAllowed('Cannot remove multiple providers together')
  }
  const thisIdentityProvider = await context.app.service(identityProviderPath).get(context.id)

  if (!thisIdentityProvider) throw new Forbidden('You do not have any identity provider')

  if (thisIdentityProvider.type === 'guest') return context

  const providers = await context.app
    .service(identityProviderPath)
    .find({ query: { userId: thisIdentityProvider.userId } })

  if (providers.total <= 1) {
    throw new MethodNotAllowed('Cannot remove the only identity provider on a user')
  }
  return context
}

/* (BEFORE) CREATE HOOKS */

async function validateAuthParams(context: HookContext<IdentityProviderService>) {
  let userId = (context.actualData as IdentityProviderData).userId
  let existingUser

  try {
    if (userId) existingUser = await context.app.service(userPath).get(userId)
  } catch (err) {
    //
  }

  let isAuthenticated = await checkTokenAuth(context, userId)

  if (!isAuthenticated) {
    if (context.params.authentication) {
      const authResult = await context.app.service('authentication').strategies.jwt.authenticate!(
        { accessToken: context.params.authentication.accessToken },
        {}
      )
      if (userId !== authResult[appConfig.authentication.entity]?.userId)
        throw new BadRequest('Cannot make identity-providers on other users')
    } else {
      if (userId && existingUser)
        throw new BadRequest('Cannot make identity-providers on existing users with no authentication')
    }
  }

  context.existingUser = existingUser
}

async function addIdentityProviderType(context: HookContext<IdentityProviderService>) {
  const isAdmin = context.existingUser && (await checkScope(context.existingUser, 'admin', 'admin'))
  if (
    !isAdmin &&
    context.params!.provider &&
    !['password', 'email', 'sms'].includes((context!.actualData as IdentityProviderData).type)
  ) {
    ;(context.data as IdentityProviderData).type = 'guest'
    ;(context.actualData as IdentityProviderData).type = 'guest' //Non-password/magiclink create requests must always be for guests
  }

  if ((context.data as IdentityProviderData).type === 'guest') {
    const existingUser = await context.app.service(userPath).find({
      query: {
        id: (context.actualData as IdentityProviderData).userId
      }
    })
    if (existingUser.data.length > 0) {
      throw new BadRequest('Cannot create a guest identity-provider on an existing user')
    }
  }
  const adminScopes = await context.app.service(scopePath).find({
    query: {
      type: 'admin:admin' as ScopeType
    }
  })

  if (adminScopes.total === 0 && (isDev || (context.actualData as IdentityProviderData).type !== 'guest')) {
    context.isAdmin = true
  }
}

async function createNewUser(context: HookContext<IdentityProviderService>) {
  const isGuest = (context.actualData as IdentityProviderType).type === 'guest'
  const avatars = await context.app
    .service(avatarPath)
    .find({ isInternal: true, query: { isPublic: true, skipUser: true, $limit: 1000 } })

  let selectedAvatarId
  while (selectedAvatarId == null) {
    const randomId = random(avatars.data.length - 1)
    const selectedAvatar = avatars.data[randomId]
    try {
      await Promise.all([
        context.app.service(staticResourcePath).get(selectedAvatar.modelResourceId),
        context.app.service(staticResourcePath).get(selectedAvatar.thumbnailResourceId)
      ])
      selectedAvatarId = selectedAvatar.id
    } catch (err) {
      console.log('error in getting resources')
      avatars.data.splice(randomId, 1)
      if (avatars.data.length < 1) throw new Error('All avatars are missing static resources')
    }
  }

  context.existingUser = await context.app.service(userPath).create({
    isGuest,
    avatarId: selectedAvatarId
  })
}

/* (AFTER) CREATE HOOKS */

async function addScopes(context: HookContext<IdentityProviderService>) {
  if (isDev && context.isAdmin === true) {
    // in dev mode, add all scopes to the first user made an admin
    const scopeTypes = await context.app.service(scopeTypePath).find({
      paginate: false
    })

    const data = scopeTypes.map(({ type }) => {
      return { userId: context.existingUser!.id, type }
    })

    await context.app.service(scopePath).create(data)
  }
}

const addDevProjectPermissions = async (context: HookContext<IdentityProviderService>) => {
  if (!isDev || !(await checkScope(context.existingUser, 'admin', 'admin'))) return

  const user = context.existingUser as UserType

  const projects = await context.app.service(projectPath).find({ paginate: false })

  const staticResourcePermission = await context.app.service(scopePath).find({
    query: {
      userId: user.id,
      type: 'static_resource:write' as ScopeType
    }
  })

  if (staticResourcePermission.total > 0) {
    for (const project of projects) {
      await context.app.service(projectPermissionPath).create({
        projectId: project.id,
        userId: user.id,
        type: 'owner'
      })
    }
  }
}

async function createAccessToken(context: HookContext<IdentityProviderService>) {
  if (!(context.result as IdentityProviderType).accessToken) {
    ;(context.result as IdentityProviderType).accessToken = await context.app
      .service('authentication')
      .createAccessToken({}, { subject: (context.result as IdentityProviderType).id.toString() })
  }
}

export default {
  around: {
    all: [
      schemaHooks.resolveExternal(identityProviderExternalResolver),
      schemaHooks.resolveResult(identityProviderResolver)
    ]
  },

  before: {
    all: [
      () => schemaHooks.validateQuery(identityProviderQueryValidator),
      schemaHooks.resolveQuery(identityProviderQueryResolver)
    ],
    find: [iff(isProvider('external'), setLoggedinUserInQuery('userId'))],
    get: [iff(isProvider('external'), checkIdentityProvider)],
    create: [
      iff(
        (context: HookContext<IdentityProviderService>) => Array.isArray(context.data),
        () => {
          throw new MethodNotAllowed('identity-provider create works only with singular entries')
        }
      ),
      () => schemaHooks.validateData(identityProviderDataValidator),
      schemaHooks.resolveData(identityProviderDataResolver),
      persistData,
      validateAuthParams,
      addIdentityProviderType,
      iff((context: HookContext<IdentityProviderService>) => !context.existingUser, createNewUser),
      (context: HookContext<IdentityProviderService>) =>
        ((context.data as IdentityProviderData).userId = context.existingUser!.id)
    ],
    update: [disallow()],
    patch: [
      iff(isProvider('external'), checkIdentityProvider),
      () => schemaHooks.validateData(identityProviderPatchValidator),
      schemaHooks.resolveData(identityProviderPatchResolver)
    ],
    remove: [iff(isProvider('external'), checkIdentityProvider, checkOnlyIdentityProvider)]
  },
  after: {
    all: [],
    find: [],
    get: [],
    create: [addScopes, addDevProjectPermissions, createAccessToken],
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
