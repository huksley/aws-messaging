import * as dotenv from 'dotenv'
import * as R from 'ramda'
import 'source-map-support/register'

export const defaultConfig = {
  NODE_ENV: 'development' as 'development' | 'product',
  LOG_LEVEL: 'info' as 'info' | 'debug' | 'warn' | 'error',
  AWS_REGION: 'eu-west-1',

  /** Should run e2e tests, potentially spending money? */
  TEST_E2E: false,
  /** Sample app token to send msg to */
  E2E_SAMPLE_TOKEN: '',
  // Real deployed URL for tests
  API_MESSAGING_URL: '',
  // DynamoDB to hold sessions
  TABLE_NAME: 'find-face-sessions',
  MESSAGE_TABLE_NAME: 'find-face-messages',
  // Google Cloud Messaging Server Key (legacy)
  FCM_SERVER_KEY: '',
  // Topic to receive profile updates by all users
  PROFILE_TOPIC: 'profile-update',
  // Enable topics
  ENABLE_TOPIC: false,
}

type defaultConfigKey = keyof typeof defaultConfig

/** Converts specific keys to boolean */
const toBoolean = (o: typeof defaultConfig, k: defaultConfigKey[]): typeof defaultConfig => {
  const oo = o as any
  for (const kk of k) {
    oo[kk] = typeof o[kk] === 'string' ? Boolean(o[kk]) : o[kk]
  }
  return o
}

/** Converts specific keys to number */
const toNumber = (o: typeof defaultConfig, k: defaultConfigKey[]): typeof defaultConfig => {
  const oo = o as any
  for (const kk of k) {
    oo[kk] = typeof o[kk] === 'string' ? Number(o[kk]) : o[kk]
  }
  return o
}

/**
 * Typed, configurable instance of application config. Use environment or .env files to define variables.
 */
export const config = toNumber(
  toBoolean(
    {
      ...defaultConfig,
      ...(dotenv.config().parsed || R.pick(R.keys(defaultConfig), process.env)),
    },
    ['TEST_E2E'],
  ),
  ['ENABLE_TOPIC'],
)
