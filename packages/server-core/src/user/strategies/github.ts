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

import { AuthenticationRequest, AuthenticationResult } from '@feathersjs/authentication'
import { Paginated } from '@feathersjs/feathers'
import { random } from 'lodash'

import { apiJobPath } from '@etherealengine/common/src/schemas/cluster/api-job.schema'
import { avatarPath, AvatarType } from '@etherealengine/common/src/schemas/user/avatar.schema'
import { githubRepoAccessRefreshPath } from '@etherealengine/common/src/schemas/user/github-repo-access-refresh.schema'
import { identityProviderPath } from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import { userApiKeyPath, UserApiKeyType } from '@etherealengine/common/src/schemas/user/user-api-key.schema'
import { InviteCode, UserName, userPath } from '@etherealengine/common/src/schemas/user/user.schema'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'

import { Octokit } from 'octokit'
import { Application } from '../../../declarations'
import config from '../../appconfig'
import { createExecutorJob } from '../../k8s-job-helper'
import { RedirectConfig } from '../../types/OauthStrategies'
import getFreeInviteCode from '../../util/get-free-invite-code'
import makeInitialAdmin from '../../util/make-initial-admin'
import { getGithubRepoAccessRefreshJobBody } from '../github-repo-access-refresh/github-repo-access-refresh.class'
import CustomOAuthStrategy, { CustomOAuthParams } from './custom-oauth'

export class GithubStrategy extends CustomOAuthStrategy {
  constructor(app: Application) {
    super()
    this.app = app
  }

  async createRefreshJob(userId) {
    const date = await getDateTimeSql()
    const newJob = await this.app.service(apiJobPath).create({
      name: '',
      startTime: date,
      endTime: date,
      returnData: '',
      status: 'pending'
    })

    const jobBody = await getGithubRepoAccessRefreshJobBody(this.app, newJob.id, userId)
    await this.app.service(apiJobPath).patch(newJob.id, {
      name: jobBody.metadata!.name
    })
    const jobLabelSelector = `etherealengine/userId=${userId},etherealengine/release=${process.env.RELEASE_NAME},etherealengine/autoUpdate=false`
    await createExecutorJob(this.app, jobBody, jobLabelSelector, 1000, newJob.id, false)
  }

  async getEntityData(profile: any, entity: any, params: CustomOAuthParams): Promise<any> {
    const baseData = await super.getEntityData(profile, null, {})
    const authResult = entity
      ? entity
      : await (this.app.service('authentication') as any).strategies.jwt.authenticate(
          { accessToken: params?.authentication?.accessToken },
          {}
        )
    const identityProvider = authResult[identityProviderPath] ? authResult[identityProviderPath] : authResult
    const userId = identityProvider ? identityProvider.userId : params?.query ? params.query.userId : undefined

    let email: string

    if (profile.email) {
      email = profile.email
    } else {
      const octoKit = new Octokit({ auth: `token ${params.access_token}` })
      const githubEmails = await octoKit.rest.users.listEmailsForAuthenticatedUser()

      email = githubEmails.data.filter((githubEmail: any) => githubEmail.primary === true)[0].email
    }

    return {
      ...baseData,
      accountIdentifier: profile.login,
      oauthToken: params.access_token,
      oauthRefreshToken: params.refresh_token,
      email,
      type: 'github',
      userId
    }
  }

  async updateEntity(entity: any, profile: any, params: CustomOAuthParams): Promise<any> {
    const authResult = await (this.app.service('authentication') as any).strategies.jwt.authenticate(
      { accessToken: params?.authentication?.accessToken },
      {}
    )
    if (!entity.userId) {
      const avatars = (await this.app
        .service(avatarPath)
        .find({ isInternal: true, query: { isPublic: true, $limit: 1000 } })) as Paginated<AvatarType>
      const code = (await getFreeInviteCode(this.app)) as InviteCode
      const newUser = await this.app.service(userPath).create({
        name: '' as UserName,
        isGuest: false,
        inviteCode: code,
        avatarId: avatars.data[random(avatars.data.length - 1)].id,
        scopes: []
      })
      entity.userId = newUser.id
      await this.app.service(identityProviderPath)._patch(entity.id, {
        userId: newUser.id,
        oauthToken: params.access_token,
        oauthRefreshToken: params.refresh_token,
        email: entity.email
      })
    } else
      await this.app.service(identityProviderPath)._patch(entity.id, {
        oauthToken: params.access_token,
        oauthRefreshToken: params.refresh_token,
        email: entity.email
      })
    const identityProvider = authResult[identityProviderPath]
    const user = await this.app.service(userPath).get(entity.userId)
    await makeInitialAdmin(this.app, user.id)
    if (user.isGuest)
      await this.app.service(userPath).patch(entity.userId, {
        isGuest: false
      })
    const apiKey = (await this.app.service(userApiKeyPath).find({
      query: {
        userId: entity.userId
      }
    })) as Paginated<UserApiKeyType>
    if (apiKey.total === 0)
      await this.app.service(userApiKeyPath).create({
        userId: entity.userId
      })
    if (entity.type !== 'guest' && identityProvider.type === 'guest') {
      await this.app.service(identityProviderPath)._remove(identityProvider.id)
      await this.app.service(userPath).remove(identityProvider.userId)
      if (!config.kubernetes.enabled)
        await this.app.service(githubRepoAccessRefreshPath).find(Object.assign({}, params, { user }))
      else await this.createRefreshJob(user.id)
      await this.userLoginEntry(entity, params)

      return super.updateEntity(entity, profile, params)
    }
    const existingEntity = await super.findEntity(profile, params)
    if (!existingEntity) {
      profile.userId = user.id
      profile.oauthToken = params.access_token
      profile.oauthRefreshToken = params.refresh_token
      const newIP = await super.createEntity(profile, params)
      if (entity.type === 'guest') await this.app.service(identityProviderPath)._remove(entity.id)
      if (!config.kubernetes.enabled)
        await this.app.service(githubRepoAccessRefreshPath).find(Object.assign({}, params, { user }))
      else await this.createRefreshJob(user.id)
      await this.userLoginEntry(newIP, params)
      return newIP
    } else if (existingEntity.userId === identityProvider.userId) {
      if (!config.kubernetes.enabled)
        await this.app.service(githubRepoAccessRefreshPath).find(Object.assign({}, params, { user }))
      else await this.createRefreshJob(user.id)
      await this.userLoginEntry(existingEntity, params)
      return existingEntity
    } else {
      throw new Error('Another user is linked to this account')
    }
  }

  async getRedirect(data: AuthenticationResult | Error, params: CustomOAuthParams): Promise<string> {
    let redirectConfig: RedirectConfig
    try {
      redirectConfig = JSON.parse(params.redirect!)
    } catch {
      redirectConfig = {}
    }
    let { domain: redirectDomain, path: redirectPath, instanceId: redirectInstanceId } = redirectConfig

    redirectDomain = redirectDomain ? `${redirectDomain}/auth/oauth/github` : config.authentication.callback.github

    if (data instanceof Error || Object.getPrototypeOf(data) === Error.prototype) {
      const err = data.message as string
      return redirectDomain + `?error=${err}`
    }

    const loginType = params.query?.userId ? 'connection' : 'login'
    let redirectUrl = `${redirectDomain}?token=${data.accessToken}&type=${loginType}`
    if (redirectPath) {
      redirectUrl = redirectUrl.concat(`&path=${redirectPath}`)
    }
    if (redirectInstanceId) {
      redirectUrl = redirectUrl.concat(`&instanceId=${redirectInstanceId}`)
    }

    return redirectUrl
  }

  async authenticate(authentication: AuthenticationRequest, originalParams: CustomOAuthParams) {
    if (authentication.error) {
      if (authentication.error.message === 'Bad credentials')
        throw new Error('You canceled the GitHub OAuth login flow')
      else throw new Error('There was a problem with the GitHub OAuth login flow: ' + authentication.error_description)
    }
    originalParams.access_token = authentication.access_token
    originalParams.refresh_token = authentication.refresh_token
    return super.authenticate(authentication, originalParams)
  }
}
export default GithubStrategy
