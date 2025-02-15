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

import { KnexSeed } from '@etherealengine/common/src/interfaces/KnexSeed'

import * as authenticationSeed from './authentication-setting/authentication-setting.seed'
import * as awsSeed from './aws-setting/aws-setting.seed'
import * as chargebeeSeed from './chargebee-setting/chargebee-setting.seed'
import * as clientSeed from './client-setting/client-setting.seed'
import * as coilSeed from './coil-setting/coil-setting.seed'
import * as emailSeed from './email-setting/email-setting.seed'
import * as helmSeed from './helm-setting/helm-setting.seed'
import * as instanceServerSeed from './instance-server-setting/instance-server-setting.seed'
import * as redisSeed from './redis-setting/redis-setting.seed'
import * as serverSeed from './server-setting/server-setting.seed'
import * as taskServerSeed from './task-server-setting/task-server-setting.seed'
import * as zendeskSeed from './zendesk-setting/zendesk-setting.seed'

export const settingSeeds: Array<KnexSeed> = [
  authenticationSeed,
  clientSeed,
  serverSeed,
  chargebeeSeed,
  taskServerSeed,
  instanceServerSeed,
  coilSeed,
  emailSeed,
  redisSeed,
  awsSeed,
  helmSeed,
  zendeskSeed,
  zendeskSeed
]
