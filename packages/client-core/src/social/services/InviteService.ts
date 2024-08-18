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

import { Paginated } from '@feathersjs/feathers'
import { useEffect } from 'react'

import { API } from '@etherealengine/common'
import { EMAIL_REGEX, INVITE_CODE_REGEX, PHONE_REGEX, USER_ID_REGEX } from '@etherealengine/common/src/regex'
import {
  InviteCode,
  InviteData,
  InviteType,
  acceptInvitePath,
  inviteCodeLookupPath,
  invitePath
} from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, getState } from '@etherealengine/hyperflux'

import { NotificationService } from '../../common/services/NotificationService'
import { AuthState } from '../../user/services/AuthService'

const buildInviteSearchQuery = (search?: string) =>
  search
    ? {
        $or: [
          {
            inviteType: {
              $like: '%' + search + '%'
            }
          },
          {
            passcode: {
              $like: '%' + search + '%'
            }
          }
        ]
      }
    : {}

export const InviteState = defineState({
  name: 'InviteState',
  initial: () => ({
    receivedInvites: {
      invites: [] as Array<InviteType>,
      skip: 0,
      limit: 100,
      total: 0
    },
    sentInvites: {
      invites: [] as Array<InviteType>,
      skip: 0,
      limit: 100,
      total: 0
    },
    sentUpdateNeeded: true,
    receivedUpdateNeeded: true,
    getSentInvitesInProgress: false,
    getReceivedInvitesInProgress: false,
    targetObjectId: '',
    targetObjectType: ''
  })
})

export const InviteService = {
  sendInvite: async (data: InviteData, inviteCode: InviteCode) => {
    if (data.identityProviderType === 'email') {
      if (!data.token || !EMAIL_REGEX.test(data.token)) {
        NotificationService.dispatchNotify(`Invalid email address: ${data.token}`, { variant: 'error' })
        return
      }
    }

    if (data.identityProviderType === 'sms') {
      if (!data.token || !PHONE_REGEX.test(data.token)) {
        NotificationService.dispatchNotify(`Invalid 10-digit US phone number: ${data.token}`, { variant: 'error' })
        return
      }
    }

    if (data.token && !data.identityProviderType) {
      NotificationService.dispatchNotify(`Invalid value: ${data.token}`, { variant: 'error' })
      return
    }

    if (inviteCode) {
      if (!INVITE_CODE_REGEX.test(inviteCode)) {
        NotificationService.dispatchNotify(`Invalid Invite Code: ${inviteCode}`, {
          variant: 'error'
        })
        return
      } else {
        try {
          const inviteCodeLookups = await API.instance.service(inviteCodeLookupPath).find({
            query: {
              inviteCode: inviteCode
            }
          })

          if (inviteCodeLookups.length === 0) {
            NotificationService.dispatchNotify(`No user has the invite code ${inviteCode}`, {
              variant: 'error'
            })
            return
          }
          data.inviteeId = inviteCodeLookups[0].id
        } catch (err) {
          NotificationService.dispatchNotify(err.message, { variant: 'error' })
        }
      }
    }

    if (data.inviteeId) {
      if (!USER_ID_REGEX.test(data.inviteeId)) {
        NotificationService.dispatchNotify('Invalid user ID', { variant: 'error' })
        return
      }
    }

    if (!data.token && !data.inviteeId) {
      NotificationService.dispatchNotify('Not a valid recipient', { variant: 'error' })
      return
    }

    try {
      const existingInviteResult = (await API.instance.service(invitePath).find({
        query: { ...data, action: 'sent' }
      })) as Paginated<InviteType>

      let inviteResult
      if (existingInviteResult.total === 0) inviteResult = await API.instance.service(invitePath).create(data)

      NotificationService.dispatchNotify('Invite Sent', { variant: 'success' })
      getMutableState(InviteState).sentUpdateNeeded.set(true)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  retrieveReceivedInvites: async (
    incDec?: 'increment' | 'decrement',
    search?: string,
    sortField = 'id',
    orderBy = 'asc'
  ) => {
    getMutableState(InviteState).getReceivedInvitesInProgress.set(true)
    const inviteState = getState(InviteState)
    const skip = inviteState.receivedInvites.skip
    const limit = inviteState.receivedInvites.limit
    const sortData = {}
    if (sortField.length > 0) {
      if (sortField === 'type') {
        sortData['inviteType'] = orderBy === 'desc' ? -1 : 1
      } else if (sortField === 'name') {
        // TO DO; need to find the proper syntax if that's possible
        // sortData[`'user.name'`] = orderBy === 'desc' ? -1 : 1
      } else {
        sortData[sortField] = orderBy === 'desc' ? -1 : 1
      }
    }

    try {
      const inviteResult = (await API.instance.service(invitePath).find({
        query: {
          $sort: sortData,
          action: 'received',
          $skip: incDec === 'increment' ? skip + limit : incDec === 'decrement' ? skip - limit : skip,
          $limit: limit,
          ...buildInviteSearchQuery(search)
        }
      })) as Paginated<InviteType>
      getMutableState(InviteState).merge({
        receivedInvites: {
          invites: inviteResult.data,
          skip: inviteResult.skip,
          limit: inviteResult.limit,
          total: inviteResult.total
        },
        receivedUpdateNeeded: false,
        getReceivedInvitesInProgress: false
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  retrieveSentInvites: async (
    incDec?: 'increment' | 'decrement',
    search?: string,
    sortField = 'id',
    orderBy = 'asc'
  ) => {
    getMutableState(InviteState).getSentInvitesInProgress.set(true)
    const inviteState = getState(InviteState)
    const skip = inviteState.sentInvites.skip
    const limit = inviteState.sentInvites.limit
    const sortData = {}
    if (sortField.length > 0) {
      if (sortField === 'type') {
        sortData['inviteType'] = orderBy === 'desc' ? -1 : 1
      } else if (sortField === 'name') {
        // TO DO; need to find the proper syntax if that's possible
        // sortData[`'invitee.name'`] = orderBy === 'desc' ? -1 : 1
      } else {
        sortData[sortField] = orderBy === 'desc' ? -1 : 1
      }
    }
    try {
      const inviteResult = (await API.instance.service(invitePath).find({
        query: {
          $sort: sortData,
          action: 'sent',
          $skip: incDec === 'increment' ? skip + limit : incDec === 'decrement' ? skip - limit : skip,
          $limit: limit,
          ...buildInviteSearchQuery(search)
        }
      })) as Paginated<InviteType>
      getMutableState(InviteState).merge({
        sentInvites: {
          invites: inviteResult.data,
          skip: inviteResult.skip,
          limit: inviteResult.limit,
          total: inviteResult.total
        },
        sentUpdateNeeded: false,
        getSentInvitesInProgress: false
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  removeInvite: async (inviteId: string) => {
    try {
      await API.instance.service(invitePath).remove(inviteId)
      getMutableState(InviteState).sentUpdateNeeded.set(true)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  acceptInvite: async (invite: InviteType) => {
    try {
      await API.instance.service(acceptInvitePath).get(invite.id, {
        query: {
          passcode: invite.passcode
        }
      })
      getMutableState(InviteState).receivedUpdateNeeded.set(true)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  declineInvite: async (invite: InviteType) => {
    try {
      await API.instance.service(invitePath).remove(invite.id)
      getMutableState(InviteState).receivedUpdateNeeded.set(true)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  updateInviteTarget: async (targetObjectType: string, targetObjectId: string) => {
    getMutableState(InviteState).merge({
      targetObjectType,
      targetObjectId
    })
  },
  useAPIListeners: () => {
    useEffect(() => {
      const inviteCreatedListener = (params) => {
        const invite = params
        const selfUser = getState(AuthState).user
        if (invite.userId === selfUser.id) {
          getMutableState(InviteState).sentUpdateNeeded.set(true)
        } else {
          getMutableState(InviteState).receivedUpdateNeeded.set(true)
        }
      }

      const inviteRemovedListener = (params) => {
        const invite = params
        const selfUser = getState(AuthState).user
        if (invite.userId === selfUser.id) {
          getMutableState(InviteState).sentUpdateNeeded.set(true)
        } else {
          getMutableState(InviteState).receivedUpdateNeeded.set(true)
        }
      }

      API.instance.service(invitePath).on('created', inviteCreatedListener)
      API.instance.service(invitePath).on('removed', inviteRemovedListener)

      return () => {
        API.instance.service(invitePath).off('created', inviteCreatedListener)
        API.instance.service(invitePath).off('removed', inviteRemovedListener)
      }
    }, [])
  }
}
