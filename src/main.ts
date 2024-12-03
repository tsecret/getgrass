import axios from 'axios';
import 'dotenv/config';
import useragent from 'fake-useragent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { v4 as uuid } from 'uuid';
import WebSocket from 'ws';
import { getUser, getDevices, findDevice } from './api'

const USER_ID = process.env.USER_ID
const PROXY = process.env.PROXY

const PING_INTERVAL_TIME = 10_000
const STATS_INTERVAL_TIME = 5 * 60_000

const sleep = async (ms: number = 2_000) => {
    console.log(`Sleeping for ${ms}ms`)
    await new Promise(res => {
        setTimeout(() => {res(true)}, ms)
    })
}

const randomSleep = async () => sleep(Math.floor(Math.random() * 10) * 1000)

class Farm {
    ws: WebSocket;
    useragent = useragent();
    deviceId = uuid();
    pingInterval: NodeJS.Timeout
    statsInterval: NodeJS.Timeout
    agent = new SocksProxyAgent(PROXY);
    hosts = ['wss://proxy2.wynd.network:4444', 'wss://proxy2.wynd.network:4650']
    host = this.hosts[Math.floor(Math.random() * this.hosts.length)]

    scores: number[] = []
    points: number[] = []

    constructor(){
      this.init()
    }

    proxyCheck = async () => {
      const res = await axios.get('https://ipinfo.io/json', { httpsAgent: this.agent, httpAgent: this.agent })
      console.log('res.data', res.data)
    }

    init = async () => {
      await randomSleep()

      const user = await getUser()
      console.log(`Farming as ${user.email} || ${user.username} || ${user.userId}`)

      this.ws = new WebSocket(this.host, { headers: { 'user-agent': this.useragent }, agent: this.agent });

      this.ws.on('error', console.error);

      this.ws.on('open', async () => {
          console.log('Connected')
      });

      this.ws.on('message', this.handleMessage);

      this.ws.on('close', async (_, reason: Buffer) => {
          console.log("Closed due: %s", reason.toString() || 'No reason')
          await this.close()
      })

      this.pingInterval = setInterval(() => this.sendPing(), PING_INTERVAL_TIME)
      this.statsInterval = setInterval(() => this.handleStats(), STATS_INTERVAL_TIME)
    }

    sendPing = () => {
      const payload = {
        action: 'PING',
        data: {},
        id: uuid(),
        version: '1.0.0',
    }
      this.sendMessage(payload)
    }

    sendMessage = (payload: any) => {
        const s = JSON.stringify(payload)
        console.log(`>>> ${s}`)
        this.ws.send(s)
    }

    handleMessage = (data: WebSocket.RawData) => {
        const message = JSON.parse(data.toString())
        console.log('<<<', message)

        if (message.action === 'AUTH'){
            const payload = {
                "id": message["id"],
                "origin_action": "AUTH",
                "result": {
                    "browser_id": this.deviceId,
                    "device_type": "extension",
                    "extension_id": "ilehaonighjijnmpnagapkhpcdbhclfg",
                    "timestamp": Math.floor(Date.now() / 1000),
                    "user_agent": this.useragent,
                    "user_id": USER_ID,
                    "version": "4.26.2"
                }
            }

            this.sendMessage(payload)

            this.sendPing()
        }

        if (message.action === 'PONG'){
          const payload = {
            id: message['id'],
            origin_action: "PONG"
          }

          this.sendMessage(payload)
        }

    }

    handleStats = async () => {
      const device = findDevice(this.deviceId, await getDevices())

      if (!device){
        console.log('No device found')
        return
      }

      console.log(`Device ${device.ipAddress} has IP score ${device.ipScore}; x${device.multiplier} points`)

      if (device.ipScore < 75){
        this.close(`IP score is ${device.ipScore}`)
      }

    }

    async close(reason: string = null) {
        console.log('Closing', reason || null)
        process.exit(1)
    }
}

new Farm();
