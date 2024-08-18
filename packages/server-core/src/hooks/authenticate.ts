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

import * as authentication from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors'
import { HookContext, NextFunction, Paginated } from '@feathersjs/feathers'
import { Octokit } from '@octokit/rest'
import { AsyncLocalStorage } from 'async_hooks'
import { isProvider } from 'feathers-hooks-common'

import { userApiKeyPath, UserApiKeyType } from '@etherealengine/common/src/schemas/user/user-api-key.schema'
import { userPath, UserType } from '@etherealengine/common/src/schemas/user/user.schema'

import { JwtPayload, verify } from 'jsonwebtoken'
import { Application } from '../../declarations'
import config from '../appconfig'

const { authenticate } = authentication.hooks

export const asyncLocalStorage = new AsyncLocalStorage<{ user: UserType }>()

/**
 * https://github.com/feathersjs-ecosystem/dataloader/blob/main/docs/guide.md
 */
export default async (context: HookContext<Application>, next: NextFunction): Promise<HookContext> => {
  const store = asyncLocalStorage.getStore()

  // If user param is already stored then we don't need to
  // authenticate. This is typically an internal service call.
  if (!config.testEnabled && store && store.user) {
    if (!context.params.user) {
      context.params.user = store.user
    }

    return next()
  }

  // No need to authenticate if it's an internal call.
  const isInternal = isProvider('server')(context)
  if (isInternal) {
    if (context.params.user) {
      asyncLocalStorage.enterWith({ user: context.params.user })
    }

    return next()
  }

  if (context.arguments[1]?.token && context.path === 'project' && context.method === 'update') {
    const appId = config.authentication.oauth.github.appId ? parseInt(config.authentication.oauth.github.appId) : null
    const token = context.arguments[1].token
    const algorithms = process.env.APP_ENV === 'development' ? 'HS256' : 'RS256'
    const jwtDecoded = verify(token, config.authentication.secret, { algorithms: [algorithms] })! as JwtPayload
    if (jwtDecoded.iss == null || parseInt(jwtDecoded.iss) !== appId)
      throw new NotAuthenticated('Invalid app credentials')
    const octoKit = new Octokit({ auth: token })
    let appResponse
    try {
      appResponse = await octoKit.rest.apps.getAuthenticated()
    } catch (err) {
      throw new NotAuthenticated('Invalid app credentials')
    }
    if (appResponse.data.id !== appId) throw new NotAuthenticated('App ID of JWT does not match installed App ID')
    context.params.appJWT = token
    context.params.signedByAppJWT = true
    delete context.arguments[1].token
    return next()
  }

  // Ignore whitelisted services & methods
  const isWhitelisted = checkWhitelist(context)
  if (isWhitelisted) {
    return next()
  }

  // Check authorization token in headers
  const authHeader = context.params.headers?.authorization

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
      context.params.user = user
      asyncLocalStorage.enterWith({ user })
      return next()
    }
  }

  // Check JWT token using feathers authentication.
  // It will throw if authentication information is not set for external requests.
  // https://feathersjs.com/api/authentication/hook.html#authenticate-hook
  context = await authenticate('jwt')(context)

  // if (!context.params[config.authentication.entity]?.userId) throw new BadRequest('Must authenticate with valid JWT or login token')
  if (context.params[config.authentication.entity]?.userId) {
    const user = await context.app.service(userPath).get(context.params[config.authentication.entity].userId)
    context.params.user = user
    asyncLocalStorage.enterWith({ user })
  }

  return next()
}

/**
 * A method to check if the service requesting is whitelisted.
 * In that scenario we dont need to perform authentication check.
 */
const checkWhitelist = (context: HookContext<Application>): boolean => {
  for (const item of config.authentication.whiteList) {
    if (typeof item === 'string' && context.path === item) {
      return true
    } else if (typeof item === 'object' && context.path === item.path && item.methods.includes(context.method)) {
      return true
    }
  }

  return false
}
