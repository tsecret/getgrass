import WebSocket from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';
import useragent from 'fake-useragent';
import { v4 as uuid } from 'uuid';
import 'dotenv/config'
import { Device, Metrics, findDevice, getDevices, getUser, sendMetrics } from './api';



const USER_ID = process.env.USER_ID
const PROXY = process.env.PROXY
const TOKEN = process.env.TOKEN

const PING_INTERVAL_TIME = 30_000
const STATS_INTERVAL_TIME = 60_000

const sleep = async () => {
    await new Promise(res => {
        setTimeout(() => {res(true)}, 2_000)
    })
}

class Farm {
    ws: WebSocket;
    useragent = useragent();
    deviceId = uuid();
    pingInterval: NodeJS.Timeout
    statsInterval: NodeJS.Timeout
    agent = new SocksProxyAgent(`socks5://${PROXY}`);

    scores: number[] = []
    points: number[] = []

    constructor(){
        console.log('Connecting')

        this.ws = new WebSocket(
            'wss://proxy.wynd.network:4650',
            { headers: { 'user-agent': this.useragent }, agent: this.agent }
        );

        this.ws.on('error', console.error);

        this.ws.on('open', async () => {
            console.log('Connected')

            const user = await getUser();
            console.log(`User ${user.username} ${user.userId} ${user.email}`)
        });

        this.ws.on('message', this.handleMessage);

        this.ws.on('close', async (_, reason: Buffer) => {
            console.log("Closed due: %s", reason.toString() || 'No reason')
            await this.close()
        })

        this.ws.on('error',  (err) => {
            console.log('ERROR', err.message)
        })

        process.on('exit', async () => {
            console.log("Process exit")
            this.ws.close()
        });

        process.on('SIGINT', async () => {
            console.log("Process SIGINT")
            this.ws.close()
        });

        this.pingInterval = setInterval(() => {
            const payload = {
                id: uuid(),
                version: '1.0.0',
                action: 'PING',
                data: {} 
            }
            this.sendMessage(payload)
        }, PING_INTERVAL_TIME)
        
        this.statsInterval = setInterval(this.handleStats, STATS_INTERVAL_TIME)

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
                    "user_id": USER_ID,
                    "user_agent": this.useragent,
                    "timestamp": new Date().getTime(),
                    "device_type": "extension",
                    "version": "2.5.0"
                }
            }

            this.sendMessage(payload)
        }

    }

    handleStats = async () => {
        let device: Device;

        try{
            const devices = await getDevices();
            device = findDevice(this.deviceId, devices);
        } catch (error){

        }
        
        if (!device){
            console.log("No device found")
            return
        }

        console.log(`Device IP: ${device.ipAddress}: Network score ${device.ipScore}%; Total points ${device.totalPoints}; Total uptime: ${device.totalUptime}`)

        try {
            const metrics: Metrics = {
                userId: USER_ID,
                totalPoints: device.totalPoints,
                totalUptime: device.totalUptime,
                ipScore: device.ipScore,
                ipAddress: device.ipAddress
            }
            await sendMetrics(metrics)
        } catch (error) {
            console.warn('Could not send metrics')
        }

        this.scores.push(device.ipScore);
        this.points.push(device.totalPoints);
        
        if (this.scores.length >= 2) {
            if (device.ipScore <= 75){
                console.log(`Device has low score`)
                await this.close()
            }

            // if (device.totalPoints <= this.points[0]){
            //     console.log(`Device not farming`)
            //     await this.close()
            // }

            this.scores = []
            this.points = []
        }

    }

    async close(){
        console.log('Closing')
        await sleep()
        process.exit(1)
    }
}

new Farm();