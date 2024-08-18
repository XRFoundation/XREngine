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
import i18n from 'i18next'
import { useEffect } from 'react'

import { API } from '@etherealengine/common'
import multiLogger from '@etherealengine/common/src/logger'
import {
  UserID,
  UserName,
  userRelationshipPath,
  UserRelationshipType
} from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, getState } from '@etherealengine/hyperflux'

import { NotificationService } from '../../common/services/NotificationService'
import { AuthState } from '../../user/services/AuthService'

const logger = multiLogger.child({ component: 'client-core:FriendService' })

//State
export const FriendState = defineState({
  name: 'FriendState',
  initial: () => ({
    relationships: [] as UserRelationshipType[],
    isFetching: false,
    updateNeeded: true
  })
})

//Service
export const FriendService = {
  getUserRelationship: async (userId: UserID) => {
    try {
      getMutableState(FriendState).isFetching.set(true)

      const relationships = (await API.instance.service(userRelationshipPath).find({
        query: {
          userId,
          $limit: 100
        }
      })) as Paginated<UserRelationshipType>

      getMutableState(FriendState).merge({ relationships: relationships.data, isFetching: false, updateNeeded: false })
    } catch (err) {
      logger.error(err)
    }
  },
  requestFriend: (userId: UserID, relatedUserId: UserID) => {
    return createRelation(userId, relatedUserId, 'requested')
  },
  acceptFriend: async (userId: UserID, relatedUserId: UserID) => {
    try {
      await API.instance.service(userRelationshipPath).patch(relatedUserId, {
        userRelationshipType: 'friend'
      })

      FriendService.getUserRelationship(userId)
    } catch (err) {
      logger.error(err)
    }
  },
  declineFriend: (userId: UserID, relatedUserId: UserID) => {
    return removeRelation(userId, relatedUserId)
  },
  unfriend: (userId: UserID, relatedUserId: UserID) => {
    return removeRelation(userId, relatedUserId)
  },
  blockUser: async (userId: UserID, relatedUserId: UserID) => {
    return createRelation(userId, relatedUserId, 'blocking')
  },
  unblockUser: (userId: UserID, relatedUserId: UserID) => {
    return removeRelation(userId, relatedUserId)
  },
  useAPIListeners: () => {
    useEffect(() => {
      const userRelationshipCreatedListener = (params) => {
        const selfUser = getState(AuthState).user
        if (params.userRelationshipType === 'requested' && selfUser.id === params.relatedUserId)
          NotificationService.dispatchNotify(
            `${params.user.name as UserName} ${i18n.t('user:friends.requestReceived')}`,
            {
              variant: 'success'
            }
          )

        FriendService.getUserRelationship(selfUser.id)
      }
      const userRelationshipPatchedListener = (params) => {
        const selfUser = getState(AuthState).user

        if (params.userRelationshipType === 'friend' && selfUser.id === params.relatedUserId) {
          NotificationService.dispatchNotify(
            `${params.user.name as UserName} ${i18n.t('user:friends.requestAccepted')}`,
            {
              variant: 'success'
            }
          )
        }

        FriendService.getUserRelationship(selfUser.id)
      }
      const userRelationshipRemovedListener = () => {
        const selfUser = getState(AuthState).user
        FriendService.getUserRelationship(selfUser.id)
      }

      API.instance.service(userRelationshipPath).on('created', userRelationshipCreatedListener)
      API.instance.service(userRelationshipPath).on('patched', userRelationshipPatchedListener)
      API.instance.service(userRelationshipPath).on('removed', userRelationshipRemovedListener)

      return () => {
        API.instance.service(userRelationshipPath).off('created', userRelationshipCreatedListener)
        API.instance.service(userRelationshipPath).off('patched', userRelationshipPatchedListener)
        API.instance.service(userRelationshipPath).off('removed', userRelationshipRemovedListener)
      }
    }, [])
  }
}

async function createRelation(userId: UserID, relatedUserId: UserID, type: 'requested' | 'blocking') {
  try {
    await API.instance.service(userRelationshipPath).create({
      relatedUserId,
      userRelationshipType: type,
      userId: '' as UserID
    })

    FriendService.getUserRelationship(userId)
  } catch (err) {
    logger.error(err)
  }
}

async function removeRelation(userId: UserID, relatedUserId: UserID) {
  try {
    await API.instance.service(userRelationshipPath).remove(relatedUserId)

    FriendService.getUserRelationship(userId)
  } catch (err) {
    logger.error(err)
  }
}
