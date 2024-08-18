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
import multiLogger from '@etherealengine/common/src/logger'
import {
  builderInfoPath,
  githubRepoAccessRefreshPath,
  InviteCode,
  projectBranchesPath,
  projectBuilderTagsPath,
  ProjectBuilderTagsType,
  projectBuildPath,
  ProjectBuildUpdateItemType,
  projectCheckSourceDestinationMatchPath,
  projectCheckUnfetchedCommitPath,
  projectCommitsPath,
  projectDestinationCheckPath,
  projectGithubPushPath,
  projectInvalidatePath,
  projectPath,
  projectPermissionPath,
  ProjectType,
  ProjectUpdateParams,
  UserID
} from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, useHookstate } from '@etherealengine/hyperflux'

import { NotificationService } from './NotificationService'

const logger = multiLogger.child({ component: 'client-core:projects' })

//State
export const PROJECT_PAGE_LIMIT = 100

export const ProjectState = defineState({
  name: 'ProjectState',
  initial: () => ({
    projects: [] as Array<ProjectType>,
    updateNeeded: true,
    rebuilding: false,
    succeeded: false,
    failed: false,
    builderTags: [] as Array<ProjectBuilderTagsType>,
    builderInfo: {
      engineVersion: '',
      engineCommit: ''
    },
    refreshingGithubRepoAccess: false
  })
})

//Service
export const ProjectService = {
  fetchProjects: async () => {
    try {
      const projects = (await API.instance.service(projectPath).find({
        query: {
          action: 'admin',
          allowed: true
        }
      })) as Paginated<ProjectType>
      getMutableState(ProjectState).merge({
        updateNeeded: false,
        projects: projects.data
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message || JSON.stringify(err), { variant: 'error' })
    }
  },

  // restricted to admin scope
  createProject: async (name: string, params?: ProjectUpdateParams) => {
    const result = await API.instance.service(projectPath).create({ name }, params)
    logger.info({ result }, 'Create project result')
    await ProjectService.fetchProjects()
  },

  // restricted to admin scope
  uploadProject: async (data: ProjectBuildUpdateItemType) => {
    const result = await API.instance.service(projectPath).update('', {
      sourceURL: data.sourceURL,
      destinationURL: data.destinationURL,
      name: data.name,
      reset: data.reset,
      commitSHA: data.commitSHA,
      sourceBranch: data.sourceBranch,
      updateType: data.updateType,
      updateSchedule: data.updateSchedule
    })
    logger.info({ result }, 'Upload project result')
    await API.instance.service(projectInvalidatePath).patch(null, { projectName: data.name })
    await ProjectService.fetchProjects()
  },

  // restricted to admin scope
  removeProject: async (id: string, params?: ProjectUpdateParams) => {
    const result = await API.instance.service(projectPath).remove(id, params)
    logger.info({ result }, 'Remove project result')
    await ProjectService.fetchProjects()
  },

  // restricted to admin scope
  checkReloadStatus: async () => {
    const result = await API.instance.service(projectBuildPath).find()
    logger.info({ result }, 'Check reload projects result')
    getMutableState(ProjectState).merge({
      rebuilding: result.running,
      succeeded: result.succeeded,
      failed: result.failed
    })
  },

  // restricted to admin scope
  invalidateProjectCache: async (projectName: string) => {
    try {
      await API.instance.service(projectInvalidatePath).patch(null, { projectName })
      await ProjectService.fetchProjects()
    } catch (err) {
      logger.error(err, 'Error invalidating project cache.')
    }
  },

  setEnabled: async (id: string, enabled: boolean) => {
    try {
      await API.instance.service(projectPath).patch(id, {
        enabled
      })
    } catch (err) {
      logger.error(err, 'Error setting project enabled')
      throw err
    }
  },

  setVisibility: async (id: string, visibility: ProjectType['visibility']) => {
    try {
      await API.instance.service(projectPath).patch(id, {
        visibility
      })
    } catch (err) {
      logger.error(err, 'Error setting project visibility')
      throw err
    }
  },

  setRepositoryPath: async (id: string, url: string) => {
    try {
      await API.instance.service(projectPath).patch(id, {
        repositoryPath: url
      })
    } catch (err) {
      logger.error(err, 'Error setting project repository path')
      throw err
    }
  },

  pushProject: async (id: string) => {
    try {
      await API.instance.service(projectGithubPushPath).patch(id, {})
    } catch (err) {
      logger.error('Error with project push', err)
      throw err
    }
  },

  createPermission: async (userInviteCode: InviteCode, projectId: string, type: string) => {
    try {
      return API.instance.service(projectPermissionPath).create({
        inviteCode: userInviteCode,
        userId: '' as UserID,
        projectId: projectId,
        type
      })
    } catch (err) {
      logger.error('Error with creating new project-permission', err)
      throw err
    }
  },

  patchPermission: async (id: string, type: string) => {
    try {
      return API.instance.service(projectPermissionPath).patch(id, {
        type: type
      })
    } catch (err) {
      logger.error('Error with patching project-permission', err)
      throw err
    }
  },

  removePermission: async (id: string) => {
    try {
      return API.instance.service(projectPermissionPath).remove(id)
    } catch (err) {
      logger.error('Error with removing project-permission', err)
      throw err
    }
  },
  useAPIListeners: () => {
    const updateNeeded = useHookstate(getMutableState(ProjectState).updateNeeded)

    useEffect(() => {
      if (updateNeeded.value) ProjectService.fetchProjects()
    }, [updateNeeded])

    useEffect(() => {
      // TODO #7254
      // API.instance.service(projectBuildPath).on('patched', (params) => {})

      const projectPatchedListener = (params) => {
        getMutableState(ProjectState).updateNeeded.set(true)
      }

      API.instance.service(projectPath).on('patched', projectPatchedListener)

      return () => {
        API.instance.service(projectPath).off('patched', projectPatchedListener)
      }
    }, [])
  },

  fetchProjectBranches: async (url: string) => {
    try {
      return (await API.instance.service(projectBranchesPath).get(url)).branches
    } catch (err) {
      logger.error('Error with fetching tags for a project', err)
      throw err
    }
  },

  fetchProjectCommits: async (url: string, branchName: string) => {
    try {
      const projectCommits = await API.instance.service(projectCommitsPath).get(url, {
        query: {
          sourceBranch: branchName
        }
      })

      return projectCommits.commits
    } catch (err) {
      logger.error('Error with fetching commits for a project', err)
      throw err
    }
  },

  checkDestinationURLValid: async ({ url, inputProjectURL }: { url: string; inputProjectURL?: string }) => {
    try {
      return API.instance.service(projectDestinationCheckPath).get(url, {
        query: {
          inputProjectURL
        }
      })
    } catch (err) {
      logger.error('Error with checking destination for a project', err)
      throw err
    }
  },

  checkUnfetchedCommit: async ({ url, selectedSHA }: { url: string; selectedSHA?: string }) => {
    try {
      return API.instance.service(projectCheckUnfetchedCommitPath).get(url, {
        query: {
          selectedSHA
        }
      })
    } catch (err) {
      logger.error('Error with checking destination for a project', err)
      throw err
    }
  },

  checkSourceMatchesDestination: async ({
    sourceURL,
    selectedSHA,
    destinationURL,
    existingProject = false
  }: {
    sourceURL: string
    selectedSHA: string
    destinationURL: string
    existingProject: boolean
  }) => {
    try {
      return API.instance.service(projectCheckSourceDestinationMatchPath).find({
        query: {
          sourceURL,
          selectedSHA,
          destinationURL,
          existingProject
        }
      })
    } catch (err) {
      logger.error('Error with checking source matches destination', err)
      throw err
    }
  },

  updateEngine: async (tag: string, updateProjects: boolean, projectsToUpdate: ProjectBuildUpdateItemType[]) => {
    try {
      await API.instance.service(projectBuildPath).patch(tag, {
        updateProjects,
        projectsToUpdate
      })
    } catch (err) {
      logger.error('Error with updating engine version', err)
      throw err
    }
  },

  fetchBuilderTags: async () => {
    try {
      const result = await API.instance.service(projectBuilderTagsPath).find()
      getMutableState(ProjectState).builderTags.set(result)
    } catch (err) {
      logger.error('Error with getting builder tags', err)
      throw err
    }
  },

  getBuilderInfo: async () => {
    try {
      const result = await API.instance.service(builderInfoPath).get()
      getMutableState(ProjectState).builderInfo.set(result)
    } catch (err) {
      logger.error('Error with getting engine info', err)
      throw err
    }
  },

  refreshGithubRepoAccess: async () => {
    try {
      getMutableState(ProjectState).refreshingGithubRepoAccess.set(true)
      await API.instance.service(githubRepoAccessRefreshPath).find()
      getMutableState(ProjectState).refreshingGithubRepoAccess.set(false)
      await ProjectService.fetchProjects()
    } catch (err) {
      logger.error('Error with refreshing Github repo access', err)
      throw err
    }
  }
}
