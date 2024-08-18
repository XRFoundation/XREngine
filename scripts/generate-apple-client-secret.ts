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

import logger from '@etherealengine/server-core/src/ServerLogger'
import cli from 'cli'
import fs from 'fs'
import Jwt from 'jsonwebtoken'

cli.enable('status')

cli.main(async () => {
  try {
    const creds = cli.parse({
      secretKeyPath: ['', 'Path to Apple SSO secret key.p8', 'string'],
      keyId: ['', 'Key ID of the Secret Key generated in Apple Developer Account', 'string'],
      teamId: ['', 'Team ID of the Apple Developer Account', 'string'],
      clientId: ['', 'The client ID of the service ID created in the Apple Developer Account', 'string']
    })
    if (!creds.secretKeyPath || !creds.keyId || !creds.teamId || !creds.clientId) {
      cli.fatal('Please provide all the required arguments')
    }
    const privateKey = fs.readFileSync(creds.secretKeyPath)

    const claims = {
      iss: creds.teamId,
      aud: 'https://appleid.apple.com',
      sub: creds.clientId
    }

    const clientSecret = Jwt.sign(claims, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: creds.keyId,
        typ: 'JWT'
      },
      expiresIn: '180d' // The token will expire in 180 days. The token can be set to expire in a shorter time but not more than 6 months.
    })

    logger.info(clientSecret)
    process.exit(0)
  } catch (err) {
    console.log('Error while generating client secret for Apple')
    console.log(err)
    cli.fatal(err)
  }
})
