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

import React, { forwardRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HiMinus, HiPlusSmall } from 'react-icons/hi2'

import { authenticationSettingPath, AuthenticationSettingType } from '@etherealengine/common/src/schema.type.module'
import { State, useHookstate } from '@etherealengine/hyperflux'
import { useFind, useMutation } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import PasswordInput from '@etherealengine/ui/src/components/tailwind/PasswordInput'
import Accordion from '@etherealengine/ui/src/primitives/tailwind/Accordion'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import Text from '@etherealengine/ui/src/primitives/tailwind/Text'
import Toggle from '@etherealengine/ui/src/primitives/tailwind/Toggle'

import { initialAuthState } from '../../../../common/initialAuthState'
import { NotificationService } from '../../../../common/services/NotificationService'

const OAUTH_TYPES = {
  APPLE: 'apple',
  DISCORD: 'discord',
  FACEBOOK: 'facebook',
  GITHUB: 'github',
  GOOGLE: 'google',
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter'
}

const AuthenticationTab = forwardRef(({ open }: { open: boolean }, ref: React.MutableRefObject<HTMLDivElement>) => {
  const { t } = useTranslation()

  const authSetting = useFind(authenticationSettingPath).data.at(0) as AuthenticationSettingType
  const id = authSetting?.id
  const loadingState = useHookstate({
    loading: false,
    errorMessage: ''
  })
  const state = useHookstate(initialAuthState)
  const holdAuth = useHookstate(initialAuthState)
  const keySecret = useHookstate({
    apple: authSetting?.oauth?.apple,
    discord: authSetting?.oauth?.discord,
    github: authSetting?.oauth?.github,
    google: authSetting?.oauth?.google,
    twitter: authSetting?.oauth?.twitter,
    linkedin: authSetting?.oauth?.linkedin,
    facebook: authSetting?.oauth?.facebook
  })
  const patchAuthSettings = useMutation(authenticationSettingPath).patch

  useEffect(() => {
    if (authSetting) {
      const tempAuthState = { ...initialAuthState }
      authSetting?.authStrategies?.forEach((el) => {
        Object.entries(el).forEach(([strategyName, strategy]) => {
          tempAuthState[strategyName] = strategy
        })
      })
      state.set(tempAuthState)
      holdAuth.set(tempAuthState)

      const tempKeySecret = JSON.parse(
        JSON.stringify({
          apple: authSetting?.oauth?.apple,
          discord: authSetting?.oauth?.discord,
          github: authSetting?.oauth?.github,
          google: authSetting?.oauth?.google,
          twitter: authSetting?.oauth?.twitter,
          linkedin: authSetting?.oauth?.linkedin,
          facebook: authSetting?.oauth?.facebook
        })
      )
      keySecret.set(tempKeySecret)
    }
  }, [authSetting])

  const handleSubmit = () => {
    loadingState.loading.set(true)
    const auth = Object.keys(state.value)
      .filter((item) => (state[item].value ? item : null))
      .filter(Boolean)
      .map((prop) => ({ [prop]: state[prop].value }))

    const oauth = { ...authSetting.oauth, ...(keySecret.value as any) }

    for (const key of Object.keys(oauth)) {
      oauth[key] = JSON.parse(JSON.stringify(oauth[key]))
    }

    patchAuthSettings(id, { authStrategies: auth, oauth: oauth })
      .then(() => {
        loadingState.set({ loading: false, errorMessage: '' })
        NotificationService.dispatchNotify(t('admin:components.setting.authSettingsRefreshNotification'), {
          variant: 'warning'
        })
      })
      .catch((e) => {
        loadingState.set({ loading: false, errorMessage: e.message })
      })
  }

  const handleCancel = () => {
    const temp = { ...initialAuthState }
    authSetting?.authStrategies?.forEach((el) => {
      Object.entries(el).forEach(([strategyName, strategy]) => {
        temp[strategyName] = strategy
      })
    })

    const tempKeySecret = JSON.parse(
      JSON.stringify({
        apple: authSetting?.oauth?.apple,
        discord: authSetting?.oauth?.discord,
        github: authSetting?.oauth?.github,
        google: authSetting?.oauth?.google,
        twitter: authSetting?.oauth?.twitter,
        linkedin: authSetting?.oauth?.linkedin,
        facebook: authSetting?.oauth?.facebook
      })
    )
    keySecret.set(tempKeySecret)
    state.set(temp)
  }

  const handleOnChangeAppId = (event, type) => {
    keySecret.set({
      ...JSON.parse(JSON.stringify(keySecret.value)),
      [type]: {
        ...JSON.parse(JSON.stringify(keySecret[type].value)),
        appId: event.target.value
      }
    })
  }

  const handleOnChangeKey = (event, type) => {
    keySecret.set({
      ...JSON.parse(JSON.stringify(keySecret.value)),
      [type]: {
        ...JSON.parse(JSON.stringify(keySecret[type].value ?? {})),
        key: event.target.value
      }
    })
  }

  const handleOnChangeSecret = (event, type) => {
    keySecret.set({
      ...JSON.parse(JSON.stringify(keySecret.value)),
      [type]: {
        ...JSON.parse(JSON.stringify(keySecret[type].value ?? {})),
        secret: event.target.value
      }
    })
  }

  const onSwitchHandle = (toggleState: State<boolean>, value: boolean) => {
    toggleState.set(value)
  }

  return (
    <Accordion
      title={t('admin:components.setting.authentication.header')}
      subtitle={t('admin:components.setting.authentication.subtitle')}
      expandIcon={<HiPlusSmall />}
      shrinkIcon={<HiMinus />}
      ref={ref}
      open={open}
    >
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Input
          className="col-span-1"
          label={t('admin:components.setting.service')}
          value={authSetting?.service || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.entity')}
          value={authSetting?.entity || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.jwtAlgorithm')}
          value={authSetting?.jwtAlgorithm || ''}
          disabled
        />

        <PasswordInput
          className="col-span-1"
          label={t('admin:components.setting.secret')}
          value={authSetting?.secret || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.jwtPublicKey')}
          value={authSetting?.jwtPublicKey || ''}
          disabled
        />
      </div>

      <Text component="h3" fontSize="xl" fontWeight="semibold" className="mb-4 mt-6 w-full">
        {t('admin:components.setting.authStrategies')}
      </Text>

      <div className="grid grid-cols-6 gap-x-6 gap-y-4">
        {Object.keys(state.value).map((strategyName, i) => {
          const displayStrategyName =
            strategyName === 'twitter' ? 'x' : strategyName === 'facebook' ? 'meta' : strategyName
          return (
            <Toggle
              key={i}
              className="col-span-1 capitalize"
              containerClassName="justify-start"
              labelClassName="capitalize"
              label={displayStrategyName}
              value={state[strategyName].value}
              disabled={strategyName === 'jwt'}
              onChange={(value) => onSwitchHandle(state[strategyName], value)}
            />
          )
        })}
      </div>

      <Text component="h3" fontSize="xl" fontWeight="semibold" className="my-4 w-full">
        {t('admin:components.setting.oauth')}
      </Text>

      <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
        {t('admin:components.setting.defaults')}
      </Text>

      <div className="grid grid-cols-3 gap-4">
        <Input
          className="col-span-1"
          label={t('admin:components.setting.host')}
          value={authSetting?.oauth?.defaults?.host || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.protocol')}
          value={authSetting?.oauth?.defaults?.protocol || ''}
          disabled
        />
      </div>

      <hr className="my-6 border border-theme-primary" />
      <div className="grid grid-cols-3 gap-4">
        {holdAuth?.apple?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.apple')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.apple?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.APPLE)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.apple?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.APPLE)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.apple || ''}
              disabled
            />
          </div>
        )}
        {holdAuth?.discord?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.discord')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.discord?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.DISCORD)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.discord?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.DISCORD)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.discord || ''}
              disabled
            />
          </div>
        )}

        {holdAuth?.linkedin?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.linkedIn')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.linkedin?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.LINKEDIN)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.linkedin?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.LINKEDIN)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.linkedin || ''}
              disabled
            />
          </div>
        )}

        {holdAuth?.facebook?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.facebook')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.facebook?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.FACEBOOK)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.facebook?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.FACEBOOK)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.facebook || ''}
              disabled
            />
          </div>
        )}

        {holdAuth?.google?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.google')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.google?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.GOOGLE)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.google?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.GOOGLE)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.google || ''}
              disabled
            />
          </div>
        )}

        {holdAuth?.twitter?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.twitter')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.twitter?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.TWITTER)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.twitter?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.TWITTER)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.twitter || ''}
              disabled
            />
          </div>
        )}

        {holdAuth?.github?.value && (
          <div className="col-span-1">
            <Text component="h4" fontSize="base" fontWeight="medium" className="my-4 w-full">
              {t('admin:components.setting.github')}
            </Text>

            <PasswordInput
              label={t('admin:components.setting.githubAppId')}
              value={keySecret?.value?.github?.appId || ''}
              onChange={(e) => handleOnChangeAppId(e, OAUTH_TYPES.GITHUB)}
            />

            <PasswordInput
              label={t('admin:components.setting.key')}
              value={keySecret?.value?.github?.key || ''}
              onChange={(e) => handleOnChangeKey(e, OAUTH_TYPES.GITHUB)}
            />

            <PasswordInput
              containerClassname="mt-2"
              label={t('admin:components.setting.secret')}
              value={keySecret?.value?.github?.secret || ''}
              onChange={(e) => handleOnChangeSecret(e, OAUTH_TYPES.GITHUB)}
            />

            <Input
              containerClassname="mt-2"
              label={t('admin:components.setting.callback')}
              value={authSetting?.callback?.github || ''}
              disabled
            />
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-8 gap-6">
        <Button size="small" className="text-primary col-span-1 bg-theme-highlight" onClick={handleCancel} fullWidth>
          {t('admin:components.common.reset')}
        </Button>

        <Button
          size="small"
          className="col-span-1"
          variant="primary"
          onClick={handleSubmit}
          startIcon={loadingState.loading.value && <LoadingView spinnerOnly className="h-6 w-6" />}
          fullWidth
        >
          {t('admin:components.common.save')}
        </Button>
      </div>
    </Accordion>
  )
})

export default AuthenticationTab
