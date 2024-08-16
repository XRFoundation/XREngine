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

import { instanceServerSettingPath, InstanceServerSettingType } from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs'
import { NO_PROXY, State, useHookstate } from '@etherealengine/hyperflux'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import PasswordInput from '@etherealengine/ui/src/components/tailwind/PasswordInput'
import Accordion from '@etherealengine/ui/src/primitives/tailwind/Accordion'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Checkbox from '@etherealengine/ui/src/primitives/tailwind/Checkbox'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import Text from '@etherealengine/ui/src/primitives/tailwind/Text'
import Toggle from '@etherealengine/ui/src/primitives/tailwind/Toggle'
import { HiPlus } from 'react-icons/hi2'
import { URLItem } from "../url-item";

const InstanceServerTab = forwardRef(({ open }: { open: boolean }, ref: React.MutableRefObject<HTMLDivElement>) => {
  const { t } = useTranslation()

  const state = useHookstate({
    loading: false,
    errorMessage: ''
  })

  const instanceServerSettingQuery = useFind(instanceServerSettingPath)
  const instanceServerSettings = instanceServerSettingQuery.data[0] ?? null
  const id = instanceServerSettings?.id
  const local = useHookstate(true)

  const settingsState = useHookstate(null as null | InstanceServerSettingType)

  useEffect(() => {
    if (instanceServerSettings) {
      settingsState.set(instanceServerSettings)
      state.set({ loading: false, errorMessage: '' })
    }
  }, [instanceServerSettings])

  const handleSubmit = (event) => {
    state.loading.set(true)
    event.preventDefault()
    const newSettings = {
      ...settingsState.get(NO_PROXY),
      createdAt: undefined!,
      updatedAt: undefined!
    } as any as InstanceServerSettingType

    Engine.instance.api
      .service(instanceServerSettingPath)
      .patch(id, newSettings)
      .then(() => {
        state.set({ loading: false, errorMessage: '' })
        instanceServerSettingQuery.refetch()
      })
      .catch((e) => {
        state.set({ loading: false, errorMessage: e.message })
      })
  }

  const handleCancel = () => {
    settingsState.set(instanceServerSettings)
  }

  if (!settingsState.value)
    return <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.loading')} />

  const settings = settingsState as State<InstanceServerSettingType>

  return (
    <Accordion
      title={t('admin:components.setting.instanceServer.header')}
      subtitle={t('admin:components.setting.instanceServer.subtitle')}
      expandIcon={<HiPlusSmall />}
      shrinkIcon={<HiMinus />}
      ref={ref}
      open={open}
    >
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Input
          className="col-span-1"
          label={t('admin:components.setting.clientHost')}
          value={settings?.clientHost.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.domain')}
          value={settings?.domain.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.rtcStartPort')}
          value={settings?.rtcStartPort.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.releaseName')}
          value={settings?.releaseName.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.rtcEndPort')}
          value={settings?.rtcEndPort.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.port')}
          value={settings?.port.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.rtcPortBlockSize')}
          value={settings?.rtcPortBlockSize.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.mode')}
          value={settings?.mode.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.identifierDigits')}
          value={settings?.identifierDigits.value || ''}
          disabled
        />

        <Input
          className="col-span-1"
          label={t('admin:components.setting.locationName')}
          value={settings?.locationName.value || ''}
          disabled
        />

        <Toggle
          containerClassName="justify-start"
          label={t('admin:components.setting.local')}
          value={local.value}
          disabled
          onChange={(value) => local.set(value)}
        />

        <Text component="h3" fontSize="xl" fontWeight="semibold" className="col-span-full mb-4">
          {t('admin:components.setting.webRTCSettings.main')}
        </Text>

        { settings.webRTCSettings.useCustomICEServers.value && settings.webRTCSettings.iceServers.value.map(iceServer => {
          return <>
            {
              <>
                <URLItem iceServer={iceServer} />
                <Button
                    startIcon={<HiPlus />}
                    size="small"
                    fullWidth
                    onClick={() => {
                      if (typeof iceServer.urls === 'string') iceServer.urls.set([iceServer.urls, ''])
                      else iceServer.urls.set(iceServer.urls.value.push(''))
                    }}
                />
                </>
            }

            <Checkbox
                className="col-span-1"
                label={t('admin:components.setting.webRTCSettings.useFixedCredentials')}
                value={iceServer.useFixedCredentials.value || false}
                onChange={(value) => iceServer.useFixedCredentials.set(value)}
            />

          {
            iceServer.useFixedCredentials.value && (
                <>
                <Input
                    className="col-span-1"
                    label={t('admin:components.setting.webRTCSettings.username')}
                    value={iceServer.username.value || ''}
                    onChange={(e) => {
                      iceServer.username.set(e.target.value)
                    }}
                />

                  <Input
                      className="col-span-1"
                      label={t('admin:components.setting.webRTCSettings.credential')}
                      value={iceServer.credential.value || ''}
                      onChange={(e) => {
                        iceServer.credential.set(e.target.value)
                      }}
                  />
                </>
            )
          }

            <Checkbox
                className="col-span-1"
                label={t('admin:components.setting.webRTCSettings.useTimeLimitedCredentials')}
                value={settings.webRTCSettings.useTimeLimitedCredentials.value || false}
                onChange={(value) => settings.webRTCSettings.useTimeLimitedCredentials.set(value)}
            />

          {
            iceServer.useTimeLimitedCredentials.value && (
                <PasswordInput
                    className="col-span-1"
                    label={t('admin:components.setting.webRTCSettings.webRTCStaticAuthSecretKey')}
                    value={iceServer.webRTCStaticAuthSecretKey.value || ''}
                    onChange={(e) => {
                      iceServer.webRTCStaticAuthSecretKey.set(e.target.value)
                    }}
                />
            )
          }
          </>
          })
        }

        <Checkbox
          className="col-span-1"
          label={t('admin:components.setting.webRTCSettings.useCustomICEServers')}
          value={settings.webRTCSettings.useCustomICEServers.value || false}
          onChange={(value) => settings.webRTCSettings.useCustomICEServers.set(value)}
        />

        <Checkbox
          className="col-span-1"
          label={t('admin:components.setting.webRTCSettings.usePrivateInstanceserverIP')}
          value={settings.webRTCSettings.usePrivateInstanceserverIP.value || false}
          onChange={(value) => settings.webRTCSettings.usePrivateInstanceserverIP.set(value)}
        />
      </div>

      <div className="mt-6 grid grid-cols-8 gap-6">
        <Button size="small" className="text-primary col-span-1 bg-theme-highlight" fullWidth onClick={handleCancel}>
          {t('admin:components.common.reset')}
        </Button>
        <Button
          size="small"
          variant="primary"
          className="col-span-1"
          fullWidth
          onClick={handleSubmit}
          startIcon={state.loading.value && <LoadingView spinnerOnly className="h-6 w-6" />}
        >
          {t('admin:components.common.save')}
        </Button>
      </div>
    </Accordion>
  )
})

export default InstanceServerTab
