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

import { AuthenticationResult } from '@feathersjs/authentication'
import { Paginated } from '@feathersjs/feathers'
import i18n from 'i18next'
import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

import config, { validateEmail, validatePhoneNumber } from '@etherealengine/common/src/config'
import { AuthUserSeed, resolveAuthUser } from '@etherealengine/common/src/interfaces/AuthUser'
import multiLogger from '@etherealengine/common/src/logger'
import {
  AuthStrategiesType,
  AvatarID,
  IdentityProviderType,
  InstanceID,
  UserApiKeyType,
  UserAvatarPatch,
  UserID,
  UserName,
  UserPatch,
  UserPublicPatch,
  UserSettingID,
  UserSettingPatch,
  UserSettingType,
  UserType,
  generateTokenPath,
  identityProviderPath,
  loginPath,
  loginTokenPath,
  magicLinkPath,
  userApiKeyPath,
  userAvatarPath,
  userPath,
  userSettingPath
} from '@etherealengine/common/src/schema.type.module'
import type { FeathersClient } from '@etherealengine/ecs/src/Engine'
import { Engine } from '@etherealengine/ecs/src/Engine'
import {
  defineState,
  getMutableState,
  getState,
  syncStateWithLocalStorage,
  useHookstate
} from '@etherealengine/hyperflux'
import { NotificationService } from '../../common/services/NotificationService'

export const logger = multiLogger.child({ component: 'client-core:AuthService' })
export const TIMEOUT_INTERVAL = 50 // ms per interval of waiting for authToken to be updated

export const UserSeed: UserType = {
  id: '' as UserID,
  name: '' as UserName,
  isGuest: true,
  avatarId: '' as AvatarID,
  avatar: {
    id: '' as AvatarID,
    name: '',
    isPublic: true,
    userId: '' as UserID,
    modelResourceId: '',
    thumbnailResourceId: '',
    identifierName: '',
    project: '',
    createdAt: '',
    updatedAt: ''
  },
  apiKey: {
    id: '',
    token: '',
    userId: '' as UserID,
    createdAt: '',
    updatedAt: ''
  },
  acceptedTOS: false,
  userSetting: {
    id: '' as UserSettingID,
    themeModes: {},
    userId: '' as UserID,
    createdAt: '',
    updatedAt: ''
  },
  scopes: [],
  identityProviders: [],
  locationAdmins: [],
  locationBans: [],
  instanceAttendance: [],
  lastLogin: {
    id: '',
    ipAddress: '',
    userAgent: '',
    identityProviderId: '',
    userId: '' as UserID,
    createdAt: ''
  },
  createdAt: '',
  updatedAt: ''
}

const resolveWalletUser = (credentials: any): UserType => {
  return {
    ...UserSeed,
    name: credentials.user.displayName,
    isGuest: true,
    avatarId: credentials.user.id,
    // avatarUrl: credentials.user.icon,
    apiKey: credentials.user.apiKey || { id: '', token: '', userId: '' as UserID }
  }
}

export const AuthState = defineState({
  name: 'AuthState',
  initial: () => ({
    isLoggedIn: false,
    isProcessing: false,
    error: '',
    authUser: AuthUserSeed,
    user: UserSeed
  }),
  extension: syncStateWithLocalStorage(['authUser'])
})

export interface EmailLoginForm {
  email: string
  password: string
}

export interface EmailRegistrationForm {
  email: string
  password: string
}

export interface AppleLoginForm {
  email: string
}

export interface GithubLoginForm {
  email: string
}

export interface LinkedInLoginForm {
  email: string
}

/**
 * Resets the current user's accessToken to a new random guest token.
 */
async function _resetToGuestToken(options = { reset: true }) {
  if (options.reset) {
    await (Engine.instance.api as FeathersClient).authentication.reset()
  }
  const newProvider = await Engine.instance.api.service(identityProviderPath).create({
    type: 'guest',
    token: uuidv4(),
    userId: '' as UserID
  })
  const accessToken = newProvider.accessToken!
  console.log(`Created new guest accessToken: ${accessToken}`)
  await (Engine.instance.api as FeathersClient).authentication.setAccessToken(accessToken as string)
  return accessToken
}

export const AuthService = {
  async doLoginAuto(forceClientAuthReset?: boolean) {
    // Oauth callbacks may be running when a guest identity-provider has been deleted.
    // This would normally cause doLoginAuto to make a guest user, which we do not want.
    // Instead, just skip it on oauth callbacks, and the callback handler will log them in.
    // The client and auth settigns will not be needed on these routes
    if (location.pathname.startsWith('/auth')) return
    const authState = getMutableState(AuthState)
    try {
      const accessToken = !forceClientAuthReset && authState?.authUser?.accessToken?.value

      if (forceClientAuthReset) {
        await (Engine.instance.api as FeathersClient).authentication.reset()
      }
      if (accessToken) {
        await (Engine.instance.api as FeathersClient).authentication.setAccessToken(accessToken as string)
      } else {
        await _resetToGuestToken({ reset: false })
      }

      let res: AuthenticationResult
      try {
        res = await (Engine.instance.api as FeathersClient).reAuthenticate()
      } catch (err) {
        if (
          err.className === 'not-found' ||
          (err.className === 'not-authenticated' && err.message === 'jwt expired') ||
          (err.className === 'not-authenticated' && err.message === 'invalid algorithm')
        ) {
          authState.merge({ isLoggedIn: false, user: UserSeed, authUser: AuthUserSeed })
          await _resetToGuestToken()
          res = await (Engine.instance.api as FeathersClient).reAuthenticate()
        } else {
          logger.error(err, 'Error re-authenticating')
          throw err
        }
      }
      if (res) {
        const identityProvider = res[identityProviderPath] as IdentityProviderType
        // Response received form reAuthenticate(), but no `id` set.
        if (!identityProvider?.id) {
          authState.merge({ isLoggedIn: false, user: UserSeed, authUser: AuthUserSeed })
          await _resetToGuestToken()
          res = await (Engine.instance.api as FeathersClient).reAuthenticate()
        }
        const authUser = resolveAuthUser(res)
        // authUser is now { accessToken, authentication, identityProvider }
        authState.merge({ authUser })
        await AuthService.loadUserData(authUser.identityProvider?.userId)
      } else {
        logger.warn('No response received from reAuthenticate()!')
      }
    } catch (err) {
      logger.error(err, 'Error on resolving auth user in doLoginAuto, logging out')
      authState.merge({ isLoggedIn: false, user: UserSeed, authUser: AuthUserSeed })

      // if (window.location.pathname !== '/') {
      //   window.location.href = '/';
      // }
    }
  },

  async loadUserData(userId: UserID) {
    try {
      const user = await Engine.instance.api.service(userPath).get(userId)
      if (!user.userSetting) {
        const settingsRes = (await Engine.instance.api
          .service(userSettingPath)
          .find({ query: { userId: userId } })) as Paginated<UserSettingType>

        if (settingsRes.total === 0) {
          user.userSetting = await Engine.instance.api.service(userSettingPath).create({ userId: userId })
        } else {
          user.userSetting = settingsRes.data[0]
        }
      }
      getMutableState(AuthState).merge({ isLoggedIn: true, user })
    } catch (err) {
      NotificationService.dispatchNotify(i18n.t('common:error.loading-error').toString(), { variant: 'error' })
    }
  },

  async loginUserByPassword(form: EmailLoginForm) {
    // check email validation.
    if (!validateEmail(form.email)) {
      NotificationService.dispatchNotify(
        i18n.t('common:error.validation-error', { type: 'email address' }).toString(),
        {
          variant: 'error'
        }
      )

      return
    }
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })

    try {
      const authenticationResult = await (Engine.instance.api as FeathersClient).authenticate({
        strategy: 'local',
        email: form.email,
        password: form.password
      })
      const authUser = resolveAuthUser(authenticationResult)

      authState.merge({ authUser })
      await AuthService.loadUserData(authUser.identityProvider.userId)
      window.location.href = '/'
    } catch (err) {
      authState.merge({ error: i18n.t('common:error.login-error') })
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  /**
   * Example vprResult:
   * {
   *   "type": "web",
   *   "dataType": "VerifiablePresentation",
   *   "data": {
   *     "presentation": {
   *       "holder": "did:web:example.com",
   *       "verifiableCredential": [
   *       ]
   *     }
   *   },
   *   "options": {
   *     "recommendedHandlerOrigins: ["https://uniwallet.cloud"]
   *   }
   * }
   * Where `vp` is a VerifiablePresentation containing multiple VCs
   * (LoginDisplayCredential, UserPreferencesCredential).
   *
   * @param vprResult {object} - VPR Query result from a user's wallet.
   */
  // async loginUserByXRWallet(vprResult: any) {
  //   const authState = getMutableState(AuthState)
  //   try {
  //     authState.merge({ isProcessing: true, error: '' })

  //     const credentials: any = parseUserWalletCredentials(vprResult)
  //     console.log(credentials)

  //     const walletUser = resolveWalletUser(credentials)
  //     const authUser = {
  //       accessToken: '',
  //       authentication: { strategy: 'did-auth' },
  //       identityProvider: {
  //         id: '',
  //         token: '',
  //         type: 'didWallet',
  //         userId: walletUser.id,
  //         createdAt: '',
  //         updatedAt: ''
  //       }
  //     }

  //     // TODO: This is temp until we move completely to XR wallet #6453
  //     const oldId = authState.user.id.value
  //     walletUser.id = oldId

  //     // loadXRAvatarForUpdatedUser(walletUser)
  //     authState.merge({ isLoggedIn: true, user: walletUser, authUser })
  //   } catch (err) {
  //     authState.merge({ error: i18n.t('common:error.login-error') })
  //     NotificationService.dispatchNotify(err.message, { variant: 'error' })
  //   } finally {
  //     authState.merge({ isProcessing: false, error: '' })
  //   }
  // },

  /**
   * Logs in the current user based on an OAuth response.
   */
  async loginUserByOAuth(service: string, location: any) {
    getMutableState(AuthState).merge({ isProcessing: true, error: '' })
    const token = getState(AuthState).authUser.accessToken
    const path = new URLSearchParams(location.search).get('redirectUrl') || location.pathname

    const redirectConfig = {
      path
    } as Record<string, string>

    const currentUrl = new URL(window.location.href)
    const domain = currentUrl.protocol.concat('//').concat(currentUrl.host)
    const instanceId = (currentUrl.searchParams.get('instanceId') as InstanceID) || null

    if (instanceId) redirectConfig.instanceId = instanceId
    if (domain) redirectConfig.domain = domain

    window.location.href = `${
      config.client.serverUrl
    }/oauth/${service}?feathers_token=${token}&redirect=${JSON.stringify(redirectConfig)}`
  },

  async removeUserOAuth(service: string) {
    const ipResult = (await Engine.instance.api.service(identityProviderPath).find()) as Paginated<IdentityProviderType>
    const ipToRemove = ipResult.data.find((ip) => ip.type === service)
    if (ipToRemove) {
      if (ipResult.total === 1) {
        NotificationService.dispatchNotify('You can not remove your last login method.', { variant: 'warning' })
      } else {
        const otherIp = ipResult.data.find((ip) => ip.type !== service)
        const newTokenResult = await Engine.instance.api.service(generateTokenPath).create({
          type: otherIp!.type,
          token: otherIp!.token
        })

        if (newTokenResult?.token) {
          getMutableState(AuthState).merge({ isProcessing: true, error: '' })
          await (Engine.instance.api as FeathersClient).authentication.setAccessToken(newTokenResult.token)
          const res = await (Engine.instance.api as FeathersClient).reAuthenticate(true)
          const authUser = resolveAuthUser(res)
          await Engine.instance.api.service(identityProviderPath).remove(ipToRemove.id)
          const authState = getMutableState(AuthState)
          authState.merge({ authUser })
          await AuthService.loadUserData(authUser.identityProvider.userId)
          authState.merge({ isProcessing: false, error: '' })
        }
      }
    }
  },

  async loginUserByJwt(accessToken: string, redirectSuccess: string, redirectError: string) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })
    try {
      await (Engine.instance.api as FeathersClient).authentication.setAccessToken(accessToken as string)
      const res = await (Engine.instance.api as FeathersClient).authenticate({
        strategy: 'jwt',
        accessToken
      })

      const authUser = resolveAuthUser(res)
      authState.merge({ authUser })
      await AuthService.loadUserData(authUser.identityProvider?.userId)
      authState.merge({ isProcessing: false, error: '' })
      let timeoutTimer = 0
      // The new JWT does not always get stored in localStorage successfully by this point, and if the user is
      // redirected to redirectSuccess now, they will still have an old JWT, which can cause them to not be logged
      // in properly. This interval waits to make sure the token has been updated before redirecting
      const waitForTokenStored = setInterval(() => {
        timeoutTimer += TIMEOUT_INTERVAL
        const authData = authState
        const storedToken = authData.authUser?.accessToken?.value
        if (storedToken === accessToken) {
          clearInterval(waitForTokenStored)
          window.location.href = redirectSuccess
        }
        // After 3 seconds without the token getting updated, send the user back anyway - something seems to have
        // gone wrong, and we don't want them stuck on the page they were on indefinitely.
        if (timeoutTimer > 3000) window.location.href = redirectSuccess
      }, TIMEOUT_INTERVAL)
    } catch (err) {
      authState.merge({ error: i18n.t('common:error.login-error') })
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
      window.location.href = `${redirectError}?error=${err.message}`
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async loginUserMagicLink(token, redirectSuccess, redirectError) {
    try {
      const res = await Engine.instance.api.service(loginPath).get(token)
      await AuthService.loginUserByJwt(res.token!, '/', '/')
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      window.location.href = redirectSuccess
    }
  },

  async logoutUser() {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })
    try {
      await (Engine.instance.api as FeathersClient).logout()
      authState.merge({ isLoggedIn: false, user: UserSeed, authUser: AuthUserSeed })
    } catch (_) {
      authState.merge({ isLoggedIn: false, user: UserSeed, authUser: AuthUserSeed })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
      window.location.reload()
    }
  },

  async registerUserByEmail(form: EmailRegistrationForm) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })
    try {
      const identityProvider: any = await Engine.instance.api.service(identityProviderPath).create({
        token: form.email,
        type: 'password',
        userId: '' as UserID
      })
      authState.authUser.merge({ identityProvider })
      window.location.href = '/auth/confirm'
    } catch (err) {
      logger.warn(err, 'Error registering user by email')
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async createMagicLink(
    emailPhone: string,
    authData: AuthStrategiesType,
    linkType?: 'email' | 'sms',
    redirectUrl?: string
  ) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })

    let type = 'email'
    let paramName = 'email'
    const enableEmailMagicLink = authData?.emailMagicLink
    const enableSmsMagicLink = authData?.smsMagicLink

    const storedToken = authState.authUser?.accessToken?.value

    if (linkType === 'email') {
      type = 'email'
      paramName = 'email'
    } else if (linkType === 'sms') {
      type = 'sms'
      paramName = 'mobile'
    } else {
      const stripped = emailPhone.replace(/-/g, '')
      if (validatePhoneNumber(stripped)) {
        if (!enableSmsMagicLink) {
          NotificationService.dispatchNotify(
            i18n.t('common:error.validation-error', { type: 'email address' }).toString(),
            {
              variant: 'error'
            }
          )
          return
        }
        type = 'sms'
        paramName = 'mobile'
        emailPhone = '+1' + stripped
      } else if (validateEmail(emailPhone)) {
        if (!enableEmailMagicLink) {
          NotificationService.dispatchNotify(
            i18n.t('common:error.validation-error', { type: 'phone number' }).toString(),
            {
              variant: 'error'
            }
          )
          return
        }
        type = 'email'
      } else {
        NotificationService.dispatchNotify(
          i18n.t('common:error.validation-error', { type: 'email or phone number' }).toString(),
          {
            variant: 'error'
          }
        )
        return
      }
    }

    try {
      await Engine.instance.api
        .service(magicLinkPath)
        .create({ type, [paramName]: emailPhone, accessToken: storedToken, redirectUrl })
      const message = {
        email: 'email-sent-msg',
        sms: 'sms-sent-msg',
        default: 'success-msg'
      }
      NotificationService.dispatchNotify(i18n.t(`user:auth.magiklink.${message[type ?? 'default']}`).toString(), {
        variant: 'success'
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
      throw new Error(err)
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async addConnectionByPassword(form: EmailLoginForm) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })

    try {
      const identityProvider = await Engine.instance.api.service(identityProviderPath).create({
        token: form.email,
        type: 'password',
        userId: '' as UserID
      })
      return AuthService.loadUserData(identityProvider.userId)
    } catch (err) {
      logger.warn(err, 'Error adding connection by password')
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async addConnectionByEmail(email: string, userId: UserID) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })
    try {
      const identityProvider = (await Engine.instance.api.service(magicLinkPath).create({
        email,
        type: 'email',
        userId
      })) as IdentityProviderType
      if (identityProvider.userId) {
        NotificationService.dispatchNotify(i18n.t('user:auth.magiklink.email-sent-msg').toString(), {
          variant: 'success'
        })
        return AuthService.loadUserData(identityProvider.userId)
      }
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async addConnectionBySms(phone: string, userId: UserID) {
    const authState = getMutableState(AuthState)
    authState.merge({ isProcessing: true, error: '' })

    let sendPhone = phone.replace(/-/g, '')
    if (sendPhone.length === 10) {
      sendPhone = '1' + sendPhone
    }

    try {
      const identityProvider = (await Engine.instance.api.service(magicLinkPath).create({
        mobile: sendPhone,
        type: 'sms',
        userId
      })) as IdentityProviderType
      if (identityProvider.userId) {
        NotificationService.dispatchNotify(i18n.t('user:auth.magiklink.sms-sent-msg').toString(), { variant: 'error' })
        return AuthService.loadUserData(identityProvider.userId)
      }
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      authState.merge({ isProcessing: false, error: '' })
    }
  },

  async addConnectionByOauth(
    oauth: 'apple' | 'facebook' | 'google' | 'github' | 'linkedin' | 'twitter' | 'discord',
    userId: UserID
  ) {
    window.open(`https://${config.client.serverHost}/auth/oauth/${oauth}?userId=${userId}`, '_blank')
  },

  async removeConnection(identityProviderId: number, userId: UserID) {
    getMutableState(AuthState).merge({ isProcessing: true, error: '' })
    try {
      await Engine.instance.api.service(identityProviderPath).remove(identityProviderId)
      return AuthService.loadUserData(userId)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    } finally {
      getMutableState(AuthState).merge({ isProcessing: false, error: '' })
    }
  },

  refreshConnections(userId: UserID) {
    AuthService.loadUserData(userId)
  },

  async updateUserSettings(id: UserSettingID, data: UserSettingPatch) {
    const response = await Engine.instance.api.service(userSettingPath).patch(id, data)
    getMutableState(AuthState).user.userSetting.merge(response)
  },

  async removeUser(userId: UserID) {
    await Engine.instance.api.service(userPath).remove(userId)
    AuthService.logoutUser()
  },

  async updateApiKey() {
    const userApiKey = (await Engine.instance.api.service(userApiKeyPath).find()) as Paginated<UserApiKeyType>

    let apiKey: UserApiKeyType | undefined
    if (userApiKey.data.length > 0) {
      apiKey = await Engine.instance.api.service(userApiKeyPath).patch(userApiKey.data[0].id, {})
    } else {
      apiKey = await Engine.instance.api.service(userApiKeyPath).create({})
    }

    getMutableState(AuthState).user.merge({ apiKey })
  },

  async createLoginToken() {
    return Engine.instance.api.service(loginTokenPath).create({})
  },

  useAPIListeners: () => {
    useEffect(() => {
      const userPatchedListener = (user: UserPublicPatch | UserPatch) => {
        console.log('USER PATCHED %o', user)

        if (!user.id) return

        const selfUser = getMutableState(AuthState).user

        if (selfUser.id.value === user.id) {
          getMutableState(AuthState).user.merge(user)
        }
      }

      const userAvatarPatchedListener = async (userAvatar: UserAvatarPatch) => {
        console.log('USER AVATAR PATCHED %o', userAvatar)

        if (!userAvatar.userId) return

        const selfUser = getMutableState(AuthState).user

        if (selfUser.id.value === userAvatar.userId) {
          const user = await Engine.instance.api.service(userPath).get(userAvatar.userId)
          getMutableState(AuthState).user.merge(user)
        }
      }

      Engine.instance.api.service(userPath).on('patched', userPatchedListener)
      Engine.instance.api.service(userAvatarPath).on('patched', userAvatarPatchedListener)

      return () => {
        Engine.instance.api.service(userPath).off('patched', userPatchedListener)
        Engine.instance.api.service(userAvatarPath).off('patched', userAvatarPatchedListener)
      }
    }, [])
  }
}

/**
 * @param vprResult {any} See `loginUserByXRWallet()`'s docstring.
 */
// function parseUserWalletCredentials(vprResult: any) {
//   console.log('PARSING:', vprResult)

//   const {
//     data: { presentation: vp }
//   } = vprResult
//   const credentials = Array.isArray(vp.verifiableCredential) ? vp.verifiableCredential : [vp.verifiableCredential]

//   const { displayName, displayIcon } = parseLoginDisplayCredential(credentials)

//   return {
//     user: {
//       id: vp.holder,
//       displayName,
//       icon: displayIcon
//       // session // this will contain the access token and helper methods
//     }
//   }
// }

/**
 * Parses the user's preferred display name (username) and avatar icon from the
 * login credentials.
 *
 * @param credentials {VerifiableCredential[]} List of VCs requested by the
 *   login request. One of those credentials needs to be of type
 *   'LoginDisplayCredential'.
 *
 * @returns {{displayName: string, displayIcon: string}}
 */
function parseLoginDisplayCredential(credentials) {
  const loginDisplayVc = credentials.find((vc) => vc.type.includes('LoginDisplayCredential'))
  const DEFAULT_ICON = 'https://material-ui.com/static/images/avatar/1.jpg'
  const displayName = loginDisplayVc.credentialSubject.displayName || 'Wallet User'
  const displayIcon = loginDisplayVc.credentialSubject.displayIcon || DEFAULT_ICON

  return { displayName, displayIcon }
}

export const useAuthenticated = () => {
  const authState = useHookstate(getMutableState(AuthState))

  useEffect(() => {
    AuthService.doLoginAuto()
  }, [])

  useEffect(() => {
    Engine.instance.userID = authState.user.id.value
  }, [authState.user.id])

  return authState.isLoggedIn.value
}
