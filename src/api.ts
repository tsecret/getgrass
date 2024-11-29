import axios from 'axios'
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

export interface Device {
  aggUptime: number
  ipAddress: string
  ipScore: number
  lastConnectedAt: Date
  multiplier: number
  userId: string
  deviceId: string
}

export interface User {
    email: string
    userId: string
    username: string
}

export interface Metrics {
    userId: string;
    ipScore: number;
    totalPoints: number;
    totalUptime: number;
    ipAddress: string;
}

const headers = { 'authorization': process.env.TOKEN }
const instance = axios.create({ headers })

export const getDevices = async (): Promise<Device[]> => {
    const res = await instance.get('https://api.getgrass.io/activeDevices' )
    return res.data.result.data
}

export const findDevice = (deviceId: string, devices: Device[]) => {
    return devices.find(device => device.deviceId === deviceId)
}

export const getUser = async (): Promise<User> => {
    const res = await instance.get('https://api.getgrass.io/retrieveUser')
    return res.data.result.data
}

export const sendMetrics = async (metrics: Metrics): Promise<Boolean> => {
    const res = await axios.post('http://157.245.23.191:3005/metrics', metrics)
    console.log(`Metrics sent`)
    return res?.data ? true : false
}
