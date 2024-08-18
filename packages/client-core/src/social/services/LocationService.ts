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

import {
  locationBanPath,
  LocationID,
  locationPath,
  LocationType,
  UserID,
  userPath
} from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { defineState, getMutableState, getState } from '@etherealengine/hyperflux'

import { API } from '@etherealengine/common'
import { useEffect } from 'react'
import { NotificationService } from '../../common/services/NotificationService'
import { AuthState } from '../../user/services/AuthService'

export const LocationSeed: LocationType = {
  id: '' as LocationID,
  name: '',
  slugifiedName: '',
  maxUsersPerInstance: 10,
  sceneId: '',
  projectId: '',
  url: '',
  sceneAsset: {} as any,
  isLobby: false,
  isFeatured: false,
  locationSetting: {
    id: '',
    locationId: '' as LocationID,
    audioEnabled: false,
    screenSharingEnabled: false,
    faceStreamingEnabled: false,
    locationType: 'private',
    videoEnabled: false,
    createdAt: '',
    updatedAt: ''
  },
  locationAuthorizedUsers: [],
  locationBans: [],
  updatedBy: '' as UserID,
  createdAt: '',
  updatedAt: ''
}

export const LocationState = defineState({
  name: 'LocationState',
  initial: () => ({
    locationName: null! as string,
    currentLocation: {
      location: LocationSeed as LocationType,
      bannedUsers: [] as string[],
      selfUserBanned: false,
      selfNotAuthorized: false
    },
    invalidLocation: false
  }),

  setLocationName: (locationName: string) => {
    getMutableState(LocationState).merge({ locationName })
  },

  fetchingCurrentSocialLocation: () => {
    getMutableState(LocationState).merge({
      currentLocation: {
        location: LocationSeed as LocationType,
        bannedUsers: [] as string[],
        selfUserBanned: false,
        selfNotAuthorized: false
      }
    })
  },

  socialLocationRetrieved: (location: LocationType) => {
    let bannedUsers = [] as string[]
    location.locationBans.forEach((ban) => {
      bannedUsers.push(ban.userId)
    })
    bannedUsers = [...new Set(bannedUsers)]
    getMutableState(LocationState).merge({
      currentLocation: {
        location: {
          ...location
        },
        bannedUsers,
        selfUserBanned: false,
        selfNotAuthorized: false
      }
    })
  },

  socialLocationNotFound: () => {
    getMutableState(LocationState).merge({
      currentLocation: {
        location: LocationSeed,
        bannedUsers: [],
        selfUserBanned: false,
        selfNotAuthorized: false
      },
      invalidLocation: true
    })
  },

  socialSelfUserBanned: (banned: boolean) => {
    getMutableState(LocationState).currentLocation.merge({ selfUserBanned: banned })
  },

  socialLocationNotAuthorized: () => {
    getMutableState(LocationState).currentLocation.merge({ selfNotAuthorized: true })
  }
})

export const LocationService = {
  getLocation: async (locationId: LocationID) => {
    try {
      LocationState.fetchingCurrentSocialLocation()
      const location = await API.instance.service(locationPath).get(locationId)
      LocationState.socialLocationRetrieved(location)
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  getLocationByName: async (locationName: string) => {
    LocationState.fetchingCurrentSocialLocation()
    const locationResult = (await API.instance.service(locationPath).find({
      query: {
        slugifiedName: locationName
      }
    })) as Paginated<LocationType>

    if (locationResult && locationResult.total > 0) {
      if (
        locationResult.data[0].locationSetting?.locationType === 'private' &&
        !locationResult.data[0].locationAuthorizedUsers?.find((authUser) => authUser.userId === Engine.instance.userID)
      ) {
        LocationState.socialLocationNotAuthorized()
      } else LocationState.socialLocationRetrieved(locationResult.data[0])
    } else {
      LocationState.socialLocationNotFound()
    }
  },
  getLobby: async () => {
    const lobbyResult = (await API.instance.service(locationPath).find({
      query: {
        isLobby: true,
        $limit: 1
      }
    })) as Paginated<LocationType>

    if (lobbyResult && lobbyResult.total > 0) {
      return lobbyResult.data[0]
    } else {
      return null
    }
  },
  banUserFromLocation: async (userId: UserID, locationId: LocationID) => {
    try {
      await API.instance.service(locationBanPath).create({
        userId: userId,
        locationId: locationId
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  useLocationBanListeners: () => {
    useEffect(() => {
      const locationBanCreatedListener = async (params) => {
        const selfUser = getState(AuthState).user
        const currentLocation = getState(LocationState).currentLocation.location
        const locationBan = params.locationBan
        if (selfUser.id === locationBan.userId && currentLocation.id === locationBan.locationId) {
          const userId = selfUser.id ?? ''
          const user = await API.instance.service(userPath).get(userId)
          getMutableState(AuthState).merge({ user })
        }
      }
      API.instance.service(locationBanPath).on('created', locationBanCreatedListener)
      return () => {
        API.instance.service(locationBanPath).off('created', locationBanCreatedListener)
      }
    }, [])
  }
}
