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

import { API } from '@etherealengine/common'
import {
  AvatarID,
  avatarPath,
  AvatarType,
  staticResourcePath,
  StaticResourceType,
  uploadAssetPath,
  UserID,
  UserName,
  userPath,
  UserType
} from '@etherealengine/common/src/schema.type.module'
import { EntityUUID } from '@etherealengine/ecs'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { AvatarNetworkAction } from '@etherealengine/engine/src/avatar/state/AvatarNetworkActions'
import { AvatarState as AvatarNetworkState } from '@etherealengine/engine/src/avatar/state/AvatarNetworkState'
import { defineState, dispatchAction, getMutableState, getState } from '@etherealengine/hyperflux'
import i18n from 'i18next'
import { NotificationService } from '../../common/services/NotificationService'
import { uploadToFeathersService } from '../../util/upload'
import { AuthState } from './AuthService'

export const AVATAR_PAGE_LIMIT = 100

export const AvatarState = defineState({
  name: 'AvatarState',
  initial: () => ({
    avatarList: [] as Array<AvatarType>,
    search: undefined as string | undefined,
    skip: 0,
    limit: AVATAR_PAGE_LIMIT,
    total: 0
  })
})

export const AvatarService = {
  async createAvatar(model: File, thumbnail: File, avatarName: string, isPublic: boolean) {
    const newAvatar = await API.instance.service(avatarPath).create({
      name: avatarName,
      isPublic
    })

    await AvatarService.uploadAvatarModel(model, thumbnail, newAvatar.identifierName, isPublic, newAvatar.id)

    if (!isPublic) {
      AvatarNetworkState.updateUserAvatarId(newAvatar.id)
    }
  },

  async fetchAvatarList(search?: string, incDec?: 'increment' | 'decrement') {
    const avatarState = getMutableState(AvatarState)
    const skip = avatarState.skip.value
    const newSkip =
      incDec === 'increment' ? skip + AVATAR_PAGE_LIMIT : incDec === 'decrement' ? skip - AVATAR_PAGE_LIMIT : skip
    const result = (await API.instance.service(avatarPath).find({
      query: {
        name: {
          $like: `%${search}%`
        },
        $skip: newSkip,
        $limit: AVATAR_PAGE_LIMIT
      }
    })) as Paginated<AvatarType>

    avatarState.merge({
      search,
      skip,
      total: result.total,
      avatarList: result.data
    })
  },

  async patchAvatar(
    originalAvatar: AvatarType,
    avatarName: string,
    updateModels: boolean,
    avatarFile?: File,
    thumbnailFile?: File
  ) {
    let payload = {
      modelResourceId: originalAvatar.modelResourceId,
      thumbnailResourceId: originalAvatar.thumbnailResourceId,
      name: avatarName
    }

    if (updateModels && avatarFile && thumbnailFile) {
      const uploadResponse = await AvatarService.uploadAvatarModel(
        avatarFile,
        thumbnailFile,
        avatarName + '_' + originalAvatar.id,
        originalAvatar.isPublic,
        originalAvatar.id
      )

      const removalPromises: Promise<StaticResourceType>[] = []
      if (uploadResponse[0].id !== originalAvatar.modelResourceId)
        removalPromises.push(AvatarService.removeStaticResource(originalAvatar.modelResourceId))
      if (uploadResponse[1].id !== originalAvatar.thumbnailResourceId)
        removalPromises.push(AvatarService.removeStaticResource(originalAvatar.thumbnailResourceId))
      await Promise.all(removalPromises)

      payload = {
        modelResourceId: uploadResponse[0].id as AvatarID,
        thumbnailResourceId: uploadResponse[1].id,
        name: avatarName
      }
    }

    const avatar = await API.instance.service(avatarPath).patch(originalAvatar.id, payload)
    getMutableState(AvatarState).avatarList.set((prevAvatarList) => {
      const index = prevAvatarList.findIndex((item) => item.id === avatar.id)
      prevAvatarList[index] = avatar
      return prevAvatarList
    })

    const userAvatarId = getState(AvatarNetworkState)[Engine.instance.userID] as AvatarID
    if (userAvatarId === avatar.id) {
      AvatarNetworkState.updateUserAvatarId(avatar.id)
    }
  },

  async removeStaticResource(id: string) {
    return API.instance.service(staticResourcePath).remove(id)
  },

  async uploadAvatarModel(avatar: File, thumbnail: File, avatarName: string, isPublic: boolean, avatarId?: AvatarID) {
    return uploadToFeathersService(uploadAssetPath, [avatar, thumbnail], {
      type: 'user-avatar-upload',
      args: {
        avatarName,
        avatarId,
        isPublic
      }
    }).promise as Promise<StaticResourceType[]>
  },

  async getAvatar(id: AvatarID) {
    try {
      return API.instance.service(avatarPath).get(id)
    } catch (err) {
      return null
    }
  },

  async updateUsername(userId: UserID, name: UserName) {
    const { name: updatedName } = (await API.instance.service(userPath).patch(userId, { name: name })) as UserType
    NotificationService.dispatchNotify(i18n.t('user:usermenu.profile.update-msg').toString(), { variant: 'success' })
    getMutableState(AuthState).user.merge({ name: updatedName })
    dispatchAction(AvatarNetworkAction.setName({ entityUUID: (userId + '_avatar') as EntityUUID, name: updatedName }))
  }
}
