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

import appRootPath from 'app-root-path'
import chargebeeInst from 'chargebee'
import dotenv from 'dotenv-flow'
import path from 'path'
import url from 'url'

import { oembedPath } from '@etherealengine/common/src/schemas/media/oembed.schema'
import { routePath } from '@etherealengine/common/src/schemas/route/route.schema'
import { acceptInvitePath } from '@etherealengine/common/src/schemas/user/accept-invite.schema'
import { discordBotAuthPath } from '@etherealengine/common/src/schemas/user/discord-bot-auth.schema'
import { githubRepoAccessWebhookPath } from '@etherealengine/common/src/schemas/user/github-repo-access-webhook.schema'
import { identityProviderPath } from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import { loginPath } from '@etherealengine/common/src/schemas/user/login.schema'

import { jwtPublicKeyPath } from '@etherealengine/common/src/schemas/user/jwt-public-key.schema'
import multiLogger from './ServerLogger'
import {
  APPLE_SCOPES,
  DISCORD_SCOPES,
  GITHUB_SCOPES,
  GOOGLE_SCOPES,
  LINKEDIN_SCOPES
} from './setting/authentication-setting/authentication-setting.seed'

const logger = multiLogger.child({ component: 'server-core:config' })

const kubernetesEnabled = process.env.KUBERNETES === 'true'
const testEnabled = process.env.TEST === 'true'

if (!testEnabled) {
  const { register } = require('trace-unhandled')
  register()

  // ensure process fails properly
  process.on('exit', async (code) => {
    const message = `Server EXIT(${code}).`
    if (code === 0) {
      logger.info(message)
    } else {
      logger.fatal(message)
    }
  })

  process.on('SIGTERM', async (err) => {
    logger.warn(err, 'Server SIGTERM.')
    process.exit(1)
  })
  process.on('SIGINT', () => {
    logger.warn('RECEIVED SIGINT.')
    process.exit(1)
  })

  // emitted when an uncaught JavaScript exception bubbles
  process.on('uncaughtException', (err) => {
    logger.fatal(err, 'UNCAUGHT EXCEPTION.')
    process.exit(1)
  })

  //emitted whenever a Promise is rejected and no error handler is attached to it
  process.on('unhandledRejection', (reason, p) => {
    logger.fatal({ reason, promise: p }, 'UNHANDLED PROMISE REJECTION.')
    process.exit(1)
  })
}

if (!kubernetesEnabled) {
  dotenv.config({
    path: appRootPath.path,
    node_env: 'local'
  })
}

if (process.env.APP_ENV === 'development' || process.env.LOCAL === 'true') {
  // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs - needed for local storage provider
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  const fs = require('fs')
  if (!fs.existsSync(appRootPath.path + '/.env') && !fs.existsSync(appRootPath.path + '/.env.local')) {
    const fromEnvPath = appRootPath.path + '/.env.local.default'
    const toEnvPath = appRootPath.path + '/.env.local'
    fs.copyFileSync(fromEnvPath, toEnvPath, fs.constants.COPYFILE_EXCL)
  }
}

/**
 * Database
 */
export const db = {
  username: testEnabled ? process.env.MYSQL_TEST_USER! : process.env.MYSQL_USER!,
  password: testEnabled ? process.env.MYSQL_TEST_PASSWORD! : process.env.MYSQL_PASSWORD!,
  database: testEnabled ? process.env.MYSQL_TEST_DATABASE! : process.env.MYSQL_DATABASE!,
  host: testEnabled ? process.env.MYSQL_TEST_HOST! : process.env.MYSQL_HOST!,
  port: testEnabled ? process.env.MYSQL_TEST_PORT! : process.env.MYSQL_PORT!,
  dialect: 'mysql',
  forceRefresh: process.env.FORCE_DB_REFRESH === 'true',
  url: '',
  charset: 'utf8mb4',
  collate: 'utf8mb4_general_ci',
  pool: {
    max: parseInt(process.env.SEQUELIZE_POOL_MAX || '5')
  }
}

db.url =
  (testEnabled ? process.env.MYSQL_TEST_URL : process.env.MYSQL_URL) ||
  `mysql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`

/**
 * Server / backend
 */
const server = {
  mode: process.env.SERVER_MODE!,
  hostname: process.env.SERVER_HOST!,
  port: process.env.SERVER_PORT!,
  clientHost: process.env.APP_HOST!,
  // Public directory (used for favicon.ico, logo, etc)
  rootDir:
    process.env.BUILD_MODE! === 'individual'
      ? path.resolve(appRootPath.path)
      : path.resolve(appRootPath.path, 'packages', 'server'),
  publicDir:
    process.env.SERVER_PUBLIC_DIR! ||
    (process.env.BUILD_MODE === 'individual'
      ? path.resolve(appRootPath.path, 'public')
      : path.resolve(appRootPath.path, 'packages', 'server', 'public')),
  nodeModulesDir: path.resolve(__dirname, '../..', 'node_modules'),
  localStorageProvider: process.env.LOCAL_STORAGE_PROVIDER!,
  localStorageProviderPort: process.env.LOCAL_STORAGE_PROVIDER_PORT!,
  corsServerPort: process.env.CORS_SERVER_PORT!,
  storageProvider: process.env.STORAGE_PROVIDER!,
  storageProviderExternalEndpoint: process.env.STORAGE_PROVIDER_EXTERNAL_ENDPOINT!,
  gaTrackingId: process.env.GOOGLE_ANALYTICS_TRACKING_ID!,
  hub: {
    endpoint: process.env.HUB_ENDPOINT!
  },
  paginate: {
    default: 10,
    max: 100
  },
  url: '',
  certPath: appRootPath.path.toString() + '/' + process.env.CERT,
  keyPath: appRootPath.path.toString() + '/' + process.env.KEY,
  gitPem: '',
  local: process.env.LOCAL === 'true',
  releaseName: process.env.RELEASE_NAME || 'local',
  matchmakerEmulationMode: process.env.MATCHMAKER_EMULATION_MODE === 'true',
  edgeCachingEnabled: process.env.STORAGE_PROVIDER! === 's3' && process.env.S3_DEV_MODE! !== 'local',
  instanceserverUnreachableTimeoutSeconds: process.env.INSTANCESERVER_UNREACHABLE_TIMEOUT_SECONDS
    ? parseInt(process.env.INSTANCESERVER_UNREACHABLE_TIMEOUT_SECONDS)
    : 10
}
const obj = kubernetesEnabled ? { protocol: 'https', hostname: server.hostname } : { protocol: 'https', ...server }
server.url = process.env.SERVER_URL || url.format(obj)

/**
 * Client / frontend
 */
const client = {
  logo: process.env.APP_LOGO!,
  title: process.env.APP_TITLE!,
  get dist() {
    if (process.env.SERVE_CLIENT_FROM_STORAGE_PROVIDER === 'true' && process.env.STORAGE_PROVIDER === 'local')
      return `https://${process.env.LOCAL_STORAGE_PROVIDER}/client/`
    return client.url
  },
  url:
    process.env.APP_URL ||
    (process.env.VITE_LOCAL_BUILD
      ? 'http://' + process.env.APP_HOST + ':' + process.env.APP_PORT
      : 'https://' + process.env.APP_HOST + ':' + process.env.APP_PORT),
  port: process.env.APP_PORT || '3000',
  releaseName: process.env.RELEASE_NAME || 'local'
}

// TODO: rename to 'instanceserver'
const instanceserver = {
  clientHost: process.env.APP_HOST!,
  rtcStartPrt: parseInt(process.env.RTC_START_PORT!),
  rtcEndPort: parseInt(process.env.RTC_END_PORT!),
  rtcPortBlockSize: parseInt(process.env.RTC_PORT_BLOCK_SIZE!),
  identifierDigits: 5,
  local: process.env.LOCAL === 'true',
  domain: process.env.INSTANCESERVER_DOMAIN || 'instanceserver.etherealengine.com',
  releaseName: process.env.RELEASE_NAME || 'local',
  port: process.env.INSTANCESERVER_PORT!,
  locationName: process.env.PRELOAD_LOCATION_NAME!,
  shutdownDelayMs: parseInt(process.env.INSTANCESERVER_SHUTDOWN_DELAY_MS!) || 0
}

/**
 * Task server generator
 */
const taskserver = {
  port: process.env.TASKSERVER_PORT!,
  processInterval: process.env.TASKSERVER_PROCESS_INTERVAL_SECONDS!
}

/**
 * Email / SMTP
 */
const email = {
  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!
    }
  },
  // Name and email of default sender (for login emails, etc)
  from: `${process.env.SMTP_FROM_NAME}` + ` <${process.env.SMTP_FROM_EMAIL}>`,
  subject: {
    // Subject of the Login Link email
    'new-user': 'Signup',
    location: 'Location invitation',
    instance: 'Location invitation',
    login: 'Login link',
    friend: 'Friend request',
    channel: 'Channel invitation'
  },
  smsNameCharacterLimit: 20
}

type WhiteListItem = {
  path: string
  methods: string[]
}

/**
 * Authentication
 */
const authentication = {
  service: identityProviderPath,
  entity: identityProviderPath,
  secret: process.env.AUTH_SECRET!.split(String.raw`\n`).join('\n'),
  authStrategies: ['jwt', 'apple', 'discord', 'facebook', 'github', 'google', 'linkedin', 'twitter', 'didWallet'],
  jwtAlgorithm: process.env.JWT_ALGORITHM,
  jwtPublicKey: process.env.JWT_PUBLIC_KEY,
  jwtOptions: {
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    expiresIn: '30 days'
  },
  bearerToken: {
    numBytes: 16
  },
  whiteList: [
    'auth',
    'oauth/:provider',
    'oauth/:provider/callback',
    'authentication',
    oembedPath,
    githubRepoAccessWebhookPath,
    { path: identityProviderPath, methods: ['create'] },
    { path: routePath, methods: ['find'] },
    { path: acceptInvitePath, methods: ['get'] },
    { path: discordBotAuthPath, methods: ['find'] },
    { path: loginPath, methods: ['get'] },
    { path: jwtPublicKeyPath, methods: ['find'] }
  ] as (string | WhiteListItem)[],
  callback: {
    apple: process.env.APPLE_CALLBACK_URL || `${client.url}/auth/oauth/apple`,
    discord: process.env.DISCORD_CALLBACK_URL || `${client.url}/auth/oauth/discord`,
    facebook: process.env.FACEBOOK_CALLBACK_URL || `${client.url}/auth/oauth/facebook`,
    github: process.env.GITHUB_CALLBACK_URL || `${client.url}/auth/oauth/github`,
    google: process.env.GOOGLE_CALLBACK_URL || `${client.url}/auth/oauth/google`,
    linkedin: process.env.LINKEDIN_CALLBACK_URL || `${client.url}/auth/oauth/linkedin`,
    twitter: process.env.TWITTER_CALLBACK_URL || `${client.url}/auth/oauth/twitter`
    // didWallet does not have a callback endpoint
  },
  oauth: {
    defaults: {
      host:
        server.hostname !== '127.0.0.1' && server.hostname !== 'localhost'
          ? server.hostname
          : server.hostname + ':' + server.port,
      protocol: 'https'
    },
    apple: {
      key: process.env.APPLE_CLIENT_ID!,
      secret: process.env.APPLE_CLIENT_SECRET!,
      scope: APPLE_SCOPES,
      response: ['raw', 'jwt'],
      nonce: true,
      custom_params: {
        response_type: 'code id_token',
        response_mode: 'form_post'
      }
    },
    discord: {
      key: process.env.DISCORD_CLIENT_ID!,
      secret: process.env.DISCORD_CLIENT_SECRET!,
      scope: DISCORD_SCOPES,
      custom_params: {
        prompt: 'none'
      }
    },
    facebook: {
      key: process.env.FACEBOOK_CLIENT_ID!,
      secret: process.env.FACEBOOK_CLIENT_SECRET!
    },
    github: {
      appId: process.env.GITHUB_APP_ID!,
      key: process.env.GITHUB_CLIENT_ID!,
      secret: process.env.GITHUB_CLIENT_SECRET!,
      scope: GITHUB_SCOPES
    },
    google: {
      key: process.env.GOOGLE_CLIENT_ID!,
      secret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: GOOGLE_SCOPES
    },
    linkedin: {
      key: process.env.LINKEDIN_CLIENT_ID!,
      secret: process.env.LINKEDIN_CLIENT_SECRET!,
      scope: LINKEDIN_SCOPES
    },
    twitter: {
      key: process.env.TWITTER_CLIENT_ID!,
      secret: process.env.TWITTER_CLIENT_SECRET!
    }
  }
}

/**
 * AWS
 */
const aws = {
  s3: {
    accessKeyId: process.env.STORAGE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_AWS_ACCESS_KEY_SECRET!,
    endpoint: process.env.STORAGE_S3_ENDPOINT!,
    staticResourceBucket: testEnabled
      ? process.env.STORAGE_S3_TEST_RESOURCE_BUCKET!
      : process.env.STORAGE_S3_STATIC_RESOURCE_BUCKET!,
    region: process.env.STORAGE_S3_REGION!,
    avatarDir: process.env.STORAGE_S3_AVATAR_DIRECTORY!,
    s3DevMode: process.env.STORAGE_S3_DEV_MODE!,
    roleArn: process.env.STORAGE_AWS_ROLE_ARN
  },
  cloudfront: {
    domain:
      process.env.SERVE_CLIENT_FROM_STORAGE_PROVIDER === 'true'
        ? server.clientHost
        : process.env.STORAGE_CLOUDFRONT_DOMAIN!,
    distributionId: process.env.STORAGE_CLOUDFRONT_DISTRIBUTION_ID!,
    region: process.env.STORAGE_CLOUDFRONT_REGION || process.env.STORAGE_S3_REGION
  },
  eks: {
    accessKeyId: process.env.EKS_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.EKS_AWS_ACCESS_KEY_SECRET!,
    roleArn: process.env.EKS_AWS_ROLE_ARN
  },
  sms: {
    accessKeyId: process.env.AWS_SMS_ACCESS_KEY_ID!,
    applicationId: process.env.AWS_SMS_APPLICATION_ID!,
    region: process.env.AWS_SMS_REGION!,
    senderId: process.env.AWS_SMS_SENDER_ID!,
    secretAccessKey: process.env.AWS_SMS_SECRET_ACCESS_KEY!
  }
}

const chargebee = {
  url: process.env.CHARGEBEE_SITE + '.chargebee.com' || 'dummy.not-chargebee.com',
  apiKey: process.env.CHARGEBEE_API_KEY!
}

const coil = {
  paymentPointer: process.env.COIL_PAYMENT_POINTER,
  clientId: process.env.COIL_API_CLIENT_ID,
  clientSecret: process.env.COIL_API_CLIENT_SECRET
}

const redis = {
  enabled: process.env.REDIS_ENABLED === 'true',
  address: process.env.REDIS_ADDRESS!,
  port: process.env.REDIS_PORT!,
  password: process.env.REDIS_PASSWORD == '' || process.env.REDIS_PASSWORD == null ? null! : process.env.REDIS_PASSWORD!
}

const scopes = {
  guest: process.env.DEFAULT_GUEST_SCOPES?.split(',') || [],
  user: process.env.DEFAULT_USER_SCOPES?.split(',') || []
}

const blockchain = {
  blockchainUrl: process.env.BLOCKCHAIN_URL,
  blockchainUrlSecret: process.env.BLOCKCHAIN_URL_SECRET
}

const ipfs = {
  enabled: process.env.USE_IPFS
}

const zendesk = {
  name: process.env.ZENDESK_KEY_NAME,
  secret: process.env.ZENDESK_SECRET,
  kid: process.env.ZENDESK_KID
}

/**
 * Full config
 */
const config = {
  deployStage: process.env.DEPLOY_STAGE!,
  authentication,
  aws,
  chargebee,
  client,
  coil,
  db,
  email,
  instanceserver,
  ipfs,
  server,
  taskserver,
  redis,
  scopes,
  blockchain,
  kubernetes: {
    enabled: kubernetesEnabled,
    serviceHost: process.env.KUBERNETES_SERVICE_HOST!,
    tcpPort: process.env.KUBERNETES_PORT_443_TCP_PORT!
  },
  noSSL: process.env.NOSSL === 'true',
  localBuild: process.env.VITE_LOCAL_BUILD === 'true',
  testEnabled,
  /** @todo when project versioning is fully implemented, remove 'undefined' check here */
  allowOutOfDateProjects:
    typeof process.env.ALLOW_OUT_OF_DATE_PROJECTS === 'undefined' || process.env.ALLOW_OUT_OF_DATE_PROJECTS === 'true',
  fsProjectSyncEnabled: process.env.FS_PROJECT_SYNC_ENABLED === 'false' ? false : true,
  zendesk
}

chargebeeInst.configure({
  site: process.env.CHARGEBEE_SITE!,
  api_key: config.chargebee.apiKey
})

export default config
