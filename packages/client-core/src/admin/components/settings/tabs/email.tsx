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

import { emailSettingPath } from '@etherealengine/common/src/schema.type.module'
import { useHookstate } from '@etherealengine/hyperflux'
import { useFind, useMutation } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import PasswordInput from '@etherealengine/ui/src/components/tailwind/PasswordInput'
import Accordion from '@etherealengine/ui/src/primitives/tailwind/Accordion'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import Text from '@etherealengine/ui/src/primitives/tailwind/Text'
import Toggle from '@etherealengine/ui/src/primitives/tailwind/Toggle'

const EmailTab = forwardRef(({ open }: { open: boolean }, ref: React.MutableRefObject<HTMLDivElement>) => {
  const { t } = useTranslation()
  const state = useHookstate({
    loading: false,
    errorMessage: ''
  })
  const emailSetting = useFind(emailSettingPath).data.at(0)
  const id = emailSetting?.id
  const smsNameCharacterLimit = useHookstate(emailSetting?.smsNameCharacterLimit)
  const smtp = useHookstate(emailSetting?.smtp)
  const auth = useHookstate(emailSetting?.smtp?.auth)
  const from = useHookstate(emailSetting?.from)
  const subject = useHookstate(emailSetting?.subject)

  const patchEmailSetting = useMutation(emailSettingPath).patch

  const handleSmtpSecure = (value) => {
    smtp.set({ ...JSON.parse(JSON.stringify(smtp.value)), secure: value })
  }

  const handleUpdateSmtp = (event, type) => {
    smtp.set({
      ...JSON.parse(JSON.stringify(smtp.value)),
      [type]: event.target.value
    })
  }

  const handleUpdateAuth = (event, type) => {
    auth.set({
      ...JSON.parse(JSON.stringify(auth.value)),
      [type]: event.target.value
    })
  }

  useEffect(() => {
    if (emailSetting) {
      smtp.set(emailSetting?.smtp)
      auth.set(emailSetting?.smtp?.auth)
      subject.set(emailSetting?.subject)
      from.set(emailSetting?.from)
    }
  }, [emailSetting])

  const handleSubmit = (event) => {
    state.loading.set(true)
    event.preventDefault()

    if (!id || !smtp.value || !auth.value || !from.value || !subject.value) return

    patchEmailSetting(id, {
      smtp: { ...smtp.value, auth: auth.value, secure: Boolean(smtp.value.secure) },
      from: from.value,
      subject: subject.value
    })
      .then(() => {
        state.set({ loading: false, errorMessage: '' })
      })
      .catch((e) => {
        state.set({ loading: false, errorMessage: e.message })
      })
  }

  const handleCancel = () => {
    smtp.set(emailSetting?.smtp)
    auth.set(emailSetting?.smtp?.auth)
    subject.set(emailSetting?.subject)
    from.set(emailSetting?.from)
    smsNameCharacterLimit.set(emailSetting?.smsNameCharacterLimit)
  }

  const handleUpdateSubject = (event, type) => {
    subject.set({
      ...JSON.parse(JSON.stringify(subject.value)),
      [type]: event.target.value
    })
  }

  return (
    <Accordion
      title={t('admin:components.setting.email.header')}
      subtitle={t('admin:components.setting.email.subtitle')}
      expandIcon={<HiPlusSmall />}
      shrinkIcon={<HiMinus />}
      ref={ref}
      open={open}
    >
      <div className="my-4 grid grid-cols-2 gap-4">
        <Text component="h2" fontSize="base" fontWeight="semibold" className="col-span-full">
          {t('admin:components.setting.smtp')}
        </Text>
        <Input
          className="col-span-2"
          label={t('admin:components.setting.host')}
          value={smtp?.value?.host || ''}
          onChange={(e) => handleUpdateSmtp(e, 'host')}
        />

        <Input
          className="col-span-2"
          label={t('admin:components.setting.port')}
          value={smtp?.value?.port || ''}
          onChange={(e) => handleUpdateSmtp(e, 'port')}
        />

        <Toggle
          className="col-span-2"
          label={t('admin:components.setting.secure')}
          value={smtp?.value?.secure || false}
          onChange={handleSmtpSecure}
        />
      </div>

      <div className="my-4 grid grid-cols-2 gap-4">
        <Text component="h2" fontSize="base" fontWeight="semibold" className="col-span-full">
          {t('admin:components.setting.from')}
        </Text>
        <Input
          className="col-span-2"
          label={t('admin:components.setting.from')}
          value={from?.value || ''}
          onChange={(e) => from.set(e.target.value)}
        />
      </div>

      <div className="my-4 grid grid-cols-2 gap-4">
        <Text component="h2" fontSize="base" fontWeight="semibold" className="col-span-full">
          {t('admin:components.setting.auth')}
        </Text>
        <Input
          className="col-span-2"
          label={t('admin:components.setting.userName')}
          value={auth?.value?.user || ''}
          onChange={(e) => handleUpdateAuth(e, 'user')}
        />

        <PasswordInput
          className="col-span-2"
          label={t('admin:components.setting.password')}
          value={auth?.value?.pass || ''}
          onChange={(e) => handleUpdateAuth(e, 'pass')}
        />
      </div>

      <div className="my-4 grid grid-cols-2 gap-4">
        <Text component="h2" fontSize="base" fontWeight="semibold" className="col-span-full">
          {t('admin:components.setting.subject')}
        </Text>
        <Input
          className="col-span-2"
          label={t('admin:components.setting.login')}
          value={subject?.value?.login || ''}
          onChange={(e) => handleUpdateSubject(e, 'login')}
        />

        <Input
          className="col-span-2"
          label={t('admin:components.setting.friend')}
          value={subject?.value?.friend || ''}
          onChange={(e) => handleUpdateSubject(e, 'friend')}
        />

        <Input
          className="col-span-2"
          label={t('admin:components.setting.channel')}
          value={subject?.value?.channel || ''}
          onChange={(e) => handleUpdateSubject(e, 'channel')}
        />

        <Input
          className="col-span-2"
          label={t('admin:components.setting.smsNameCharLimit')}
          value={smsNameCharacterLimit?.value?.toString() || ''}
          disabled
        />

        {state.errorMessage.value && (
          <div className="col-span-full">
            <Text component="h3" className="text-red-700">
              {state.errorMessage.value}
            </Text>
          </div>
        )}

        <div className="col-span-1 grid grid-cols-4 gap-6">
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
      </div>
    </Accordion>
  )
})

export default EmailTab
