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

import { Icon as Iconify } from '@iconify/react'
import React, { Fragment, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import Avatar from '@etherealengine/ui/src/primitives/mui/Avatar'
import Button from '@etherealengine/ui/src/primitives/mui/Button'
import Divider from '@etherealengine/ui/src/primitives/mui/Divider'
import Grid from '@etherealengine/ui/src/primitives/mui/Grid'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'
import IconButton from '@etherealengine/ui/src/primitives/mui/IconButton'
import List from '@etherealengine/ui/src/primitives/mui/List'
import ListItem from '@etherealengine/ui/src/primitives/mui/ListItem'
import ListItemAvatar from '@etherealengine/ui/src/primitives/mui/ListItemAvatar'
import ListItemText from '@etherealengine/ui/src/primitives/mui/ListItemText'
import Typography from '@etherealengine/ui/src/primitives/mui/Typography'

import { clientSettingPath } from '@etherealengine/common/src/schema.type.module'
import { AuthState } from '../../../user/services/AuthService'
import { userHasAccess } from '../../../user/userHasAccess'
import styles from '../../styles/settings.module.scss'
import Authentication from './Authentication'
import Aws from './Aws'
import ChargeBee from './Chargebee'
import Client from './Client'
import ClientTheme from './ClientTheme'
import Coil from './Coil'
import Email from './Email'
import Helm from './Helm'
import InstanceServer from './InstanceServer'
import Project from './Project'
import Redis from './Redis'
import Server from './Server'
import TaskServer from './TaskServer'

const settingItems = [
  {
    name: 'project',
    title: 'Project',
    icon: <Icon type="Code" sx={{ color: 'orange' }} />,
    content: <Project />,
    scope: 'settings:read'
  },
  {
    name: 'server',
    title: 'Server',
    icon: <Iconify icon="carbon:bare-metal-server" color="orange" />,
    content: <Server />,
    scope: 'settings:read'
  },
  {
    name: 'helm',
    title: 'Helm Charts',
    icon: <Icon type="Poll" sx={{ color: 'orange' }} />,
    content: <Helm />,
    scope: 'settings:read'
  },
  {
    name: 'client',
    title: 'Client',
    icon: <Icon type="ViewCompact" sx={{ color: 'orange' }} />,
    content: <Client />,
    scope: ['settings:read', `${clientSettingPath}:read`]
  },
  {
    name: 'clientTheme',
    title: 'Client Theme',
    icon: <Icon type="FormatColorFill" sx={{ color: 'orange' }} />,
    content: <ClientTheme />,
    scope: ['settings:read', `${clientSettingPath}:read`]
  },
  {
    name: 'instanceServer',
    title: 'Instance Server',
    icon: <Icon type="Hub" sx={{ color: 'orange' }} />,
    content: <InstanceServer />,
    scope: 'settings:read'
  },
  {
    name: 'taskServer',
    title: 'Task Server',
    icon: <Icon type="ListAlt" sx={{ color: 'orange' }} />,
    content: <TaskServer />,
    scope: 'settings:read'
  },
  {
    name: 'email',
    title: 'Email',
    icon: <Icon type="MailOutline" sx={{ color: 'orange' }} />,
    content: <Email />,
    scope: 'settings:read'
  },
  {
    name: 'authentication',
    title: 'Authentication',
    icon: <Icon type="Lock" sx={{ color: 'orange' }} />,
    content: <Authentication />,
    scope: 'settings:read'
  },
  {
    name: 'aws',
    title: 'AWS',
    icon: <Iconify icon="logos:aws" />,
    content: <Aws />,
    scope: 'settings:read'
  },
  {
    name: 'chargebee',
    title: 'Chargebee',
    icon: <Iconify icon="logos:chargebee-icon" />,
    content: <ChargeBee />,
    scope: 'settings:read'
  },
  {
    name: 'redis',
    title: 'Redis',
    icon: <Iconify icon="logos:redis" />,
    content: <Redis />,
    scope: 'settings:read'
  },
  {
    name: 'coil',
    title: 'Coil',
    icon: <Iconify icon="simple-icons:coil" color="orange" />,
    content: <Coil />,
    scope: 'settings:read'
  }
]

interface SidebarProps {
  selected: string
  onChange: (name: string) => void
  userAccessibleSettings: typeof settingItems
}

const Sidebar = ({ selected, onChange, userAccessibleSettings }: SidebarProps) => {
  return (
    <List>
      {userAccessibleSettings.map((item) => (
        <Fragment key={item.name}>
          <ListItem
            button
            onClick={() => onChange(item.name)}
            className={selected === item.name ? `${styles.focused}` : `${styles.notFocused}`}
          >
            <ListItemAvatar>
              <Avatar style={{ background: '#5e5a4d' }}>{item.icon}</Avatar>
            </ListItemAvatar>
            <ListItemText primary={item.title} />
          </ListItem>
          <Divider variant="inset" component="li" sx={{ marginLeft: '0px' }} />
        </Fragment>
      ))}
    </List>
  )
}

const Setting = () => {
  const rootRef = useRef<any>()
  const selectedItem = useHookstate('')
  const menuVisible = useHookstate(false)
  const { t } = useTranslation()
  const user = useHookstate(getMutableState(AuthState)).user
  const userAccessibleSettings = useMemo(
    () =>
      user.value
        ? settingItems.filter((item) =>
            Array.isArray(item.scope) ? item.scope.find((scope) => userHasAccess(scope)) : userHasAccess(item.scope)
          )
        : [],
    [user]
  )

  const settingItem = settingItems.find((item) => item.name === selectedItem.value)

  useEffect(() => {
    rootRef?.current?.scrollIntoView()
  }, [menuVisible.value])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    const settingsItemsNames = userAccessibleSettings.map((item) => item.name)
    if (settingsItemsNames.indexOf(hash) >= 0) selectedItem.set(hash)
    else if (userAccessibleSettings.length > 0) {
      window.location.hash = `#${userAccessibleSettings[0].name}`
      selectedItem.set(userAccessibleSettings[0].name)
    }
  }, [userAccessibleSettings])

  return (
    <div ref={rootRef}>
      <div className={styles.invisible}>
        {!menuVisible.value && (
          <Button size="small" onClick={() => menuVisible.set(true)} className={styles.menuBtn}>
            <Icon type="Menu" />
          </Button>
        )}
        {menuVisible.value && (
          <div className={styles.hoverSettings}>
            <Grid display="flex" flexDirection="row" alignItems="center" marginBottom="10px">
              <Typography variant="h6" className={styles.settingsHeading}>
                {t('admin:components.setting.settings')}
              </Typography>
              <IconButton
                onClick={() => menuVisible.set(false)}
                style={{
                  color: 'orange',
                  fontSize: '3rem',
                  background: 'transparent',
                  position: 'absolute',
                  right: '10px'
                }}
                icon={<Icon type="Close" />}
              />
            </Grid>
            <Sidebar
              userAccessibleSettings={userAccessibleSettings}
              selected={selectedItem.value}
              onChange={(name) => {
                window.location.hash = `#${name}`
                selectedItem.set(name)
              }}
            />
          </div>
        )}
      </div>
      <Grid container spacing={3}>
        <Grid item sm={3} lg={3} className={styles.visible}>
          <Typography variant="h6" className={styles.settingsHeading}>
            {t('admin:components.setting.settings')}
          </Typography>
          <Sidebar
            userAccessibleSettings={userAccessibleSettings}
            selected={selectedItem.value}
            onChange={(name) => {
              window.location.hash = `#${name}`
              selectedItem.set(name)
            }}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={12} lg={9}>
          <div className={styles.contents}>{settingItem?.content}</div>
        </Grid>
      </Grid>
    </div>
  )
}

export default Setting
