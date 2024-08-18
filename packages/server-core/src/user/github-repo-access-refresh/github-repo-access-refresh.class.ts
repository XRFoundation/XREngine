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

import { Paginated, ServiceInterface } from '@feathersjs/feathers'
import { KnexAdapterParams } from '@feathersjs/knex'

import {
  githubRepoAccessPath,
  GithubRepoAccessType
} from '@etherealengine/common/src/schemas/user/github-repo-access.schema'
import {
  identityProviderPath,
  IdentityProviderType
} from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import * as k8s from '@kubernetes/client-node'

import { UserID } from '@etherealengine/common/src/schemas/user/user.schema'
import { Application } from '../../../declarations'
import { getJobBody } from '../../k8s-job-helper'
import { getUserRepos } from '../../projects/project/github-helper'
import logger from '../../ServerLogger'

export interface GithubRepoAccessRefreshParams extends KnexAdapterParams {}

export async function getGithubRepoAccessRefreshJobBody(
  app: Application,
  jobId: string,
  userId: UserID
): Promise<k8s.V1Job> {
  const command = [
    'npx',
    'cross-env',
    'ts-node',
    '--swc',
    'scripts/refresh-gh-repo-access.ts',
    '--userId',
    userId,
    '--jobId',
    jobId
  ]

  const labels = {
    'etherealengine/ghRepoAccessRefresh': 'true',
    'etherealengine/autoUpdate': 'false',
    'etherealengine/userId': userId,
    'etherealengine/release': process.env.RELEASE_NAME!
  }

  const name = `${process.env.RELEASE_NAME}-gh-repo-refresh-${userId.slice(0, 8)}-update`

  return getJobBody(app, command, name, labels)
}

/**
 * A class for Github Repo Access Refresh service
 */
export class GithubRepoAccessRefreshService implements ServiceInterface<void, GithubRepoAccessRefreshParams> {
  app: Application

  constructor(app: Application) {
    this.app = app
  }

  async find(params?: GithubRepoAccessRefreshParams) {
    try {
      const githubIdentityProvider = (await this.app.service(identityProviderPath).find({
        query: {
          userId: params?.user!.id,
          type: 'github',
          $limit: 1
        }
      })) as Paginated<IdentityProviderType>

      if (githubIdentityProvider.data.length > 0) {
        const existingGithubRepoAccesses = (await this.app.service(githubRepoAccessPath).find({
          query: {
            identityProviderId: githubIdentityProvider.data[0].id
          },
          paginate: false
        })) as any as GithubRepoAccessType[]

        const githubRepos = await getUserRepos(githubIdentityProvider.data[0].oauthToken!, this.app)
        await Promise.all(
          githubRepos.map(async (repo) => {
            const matchingAccess = existingGithubRepoAccesses.find((access) => access.repo === repo.html_url)
            const hasWriteAccess = repo.permissions.admin || repo.permissions.maintain || repo.permissions.push
            if (!matchingAccess)
              await this.app.service(githubRepoAccessPath).create({
                repo: repo.html_url,
                identityProviderId: githubIdentityProvider.data[0].id,
                hasWriteAccess
              })
            else
              await this.app.service(githubRepoAccessPath).patch(matchingAccess.id, {
                hasWriteAccess
              })
          })
        )
        const urlsOnly = githubRepos.map((repo) => repo.html_url)
        await Promise.all(
          existingGithubRepoAccesses.map(async (repoAccess) => {
            if (urlsOnly.indexOf(repoAccess.repo) < 0)
              await this.app.service(githubRepoAccessPath).remove(repoAccess.id)
          })
        )
      }
      return
    } catch (err) {
      logger.error(err)
      throw err
    }
  }
}
