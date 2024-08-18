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
import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, discardQuery, iff, iffElse, isProvider } from 'feathers-hooks-common'

import {
  inviteDataValidator,
  invitePatchValidator,
  inviteQueryValidator
} from '@etherealengine/common/src/schemas/social/invite.schema'
import {
  IdentityProviderType,
  identityProviderPath
} from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import { userRelationshipPath } from '@etherealengine/common/src/schemas/user/user-relationship.schema'
import inviteRemoveAuthenticate from '@etherealengine/server-core/src/hooks/invite-remove-authenticate'
import attachOwnerIdInBody from '@etherealengine/server-core/src/hooks/set-loggedin-user-in-body'
import attachOwnerIdInQuery from '@etherealengine/server-core/src/hooks/set-loggedin-user-in-query'

import { HookContext } from '../../../declarations'
import isAction from '../../hooks/is-action'
import { sendInvite } from '../../hooks/send-invite'
import verifyScope from '../../hooks/verify-scope'
import { InviteService } from './invite.class'
import {
  inviteDataResolver,
  inviteExternalResolver,
  invitePatchResolver,
  inviteQueryResolver,
  inviteResolver
} from './invite.resolvers'

async function handleInvitee(context: HookContext<InviteService>) {
  const identityProviders = (await context.app.service(identityProviderPath).find({
    query: {
      userId: context.params.user!.id
    }
  })) as Paginated<IdentityProviderType>
  const identityProviderTokens = identityProviders.data.map((provider) => provider.token)

  const inviteeQuery = [
    {
      inviteeId: context.params.user!.id
    },
    {
      token: {
        $in: identityProviderTokens
      }
    }
  ]

  const $or = context.params.query?.$or ? [...context.param.query.$or, ...inviteeQuery] : inviteeQuery

  context.params.query = {
    ...context.params.query,
    $or
  }
}

async function removeFriend(context: HookContext<InviteService>) {
  if (!context.id) return
  const invite = await context.service.get(context.id)
  if (invite.inviteType === 'friend' && invite.inviteeId && !context.params?.preventUserRelationshipRemoval) {
    const relatedUserId = invite.userId === context.params.user!.id ? invite.inviteeId : invite.userId
    await context.app.service(userRelationshipPath).remove(relatedUserId, context.params as any)
  }
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(inviteExternalResolver), schemaHooks.resolveResult(inviteResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(inviteQueryValidator), schemaHooks.resolveQuery(inviteQueryResolver)],
    find: [
      iffElse(
        (context) => !!context.params.query?.action,
        [iff(isAction('received'), handleInvitee), iff(isAction('sent'), attachOwnerIdInQuery('userId'))],
        [verifyScope('invite', 'read')]
      ),
      discardQuery('action')
    ],
    get: [iff(isProvider('external'), attachOwnerIdInQuery('userId'))],
    create: [
      attachOwnerIdInBody('userId'),
      schemaHooks.validateData(inviteDataValidator),
      schemaHooks.resolveData(inviteDataResolver)
    ],
    update: [disallow()],
    patch: [
      iff(isProvider('external'), verifyScope('invite', 'write')),
      schemaHooks.validateData(invitePatchValidator),
      schemaHooks.resolveData(invitePatchResolver)
    ],
    remove: [iff(isProvider('external'), inviteRemoveAuthenticate(), removeFriend)]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [sendInvite],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as any
