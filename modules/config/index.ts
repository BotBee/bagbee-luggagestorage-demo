import getConfig from 'next/config'
import { AppConfig } from '../../next-config'

const getAppConfig = (): AppConfig => getConfig()

export default getAppConfig
