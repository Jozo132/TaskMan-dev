// @ts-check
"use strict"


const { Worker, parentPort: master, workerData } = require('worker_threads')

const Timeout = ms => new Promise(r => setTimeout(() => r('<timeout>'), ms))

const console_log = console.log
const console_error = console.error

/**
 * @typedef {{ name: string, worker: WorkMan }} IPCWorker
 * @typedef {{ id: number, event: 'restart' | 'restartKill' | 'shutdown' | 'kill', destination: string, data: any[]  }} MasterSuperEventMessage 
 * @typedef {{ id: number, event: string, data: any[] }} MasterEventMessage
 * @typedef {{ id: number, resolve: Function, reject: Function }} IPCRequest
 * @typedef { (event: string, data: any[], res: Function, rej: Function) => void } IPCRequestHandler
 * @typedef {{ id: number, data?: string, error?: any }} SlaveSuperEventMessage
 * @typedef {{ id: number, data?: string, error?: any }} SlaveEventMessage
 */



class WorkMan {
    #i = 0
    /** @type { Worker | null } */
    #worker = null
    #name
    #path
    #workerData
    #timeout

    /** @type { IPCRequest[] } */
    #requests = []


    #_on

    /**
     * @param { string } name
     * @param { string } path
     * @param { any } [workerData] 
     * @param { number } [timeout]
    */
    constructor(name, path, workerData, timeout = 5_000) {
        this.#name = name
        this.#path = path
        workerData = workerData || {}
        workerData = workerData.name || name
        this.#workerData = workerData
        this.#timeout = timeout
        this.#_on = (type, event, data) => { }
    }

    start() {
        if (this.#worker) throw new Error(`Worker ${this.#name} - Worker already started`)
        this.#worker = new Worker(this.#path, { workerData: this.#workerData })
        this.#worker.on('message', args => this.#onResponse(args))
        this.#worker.on('error', args => this.#onError(args))
        this.#worker.on('exit', args => this.#onExit(args))
    }

    #onResponse(message) {
        const { id, type, event, data, error } = message
        if (id) {
            const request = this.#requests.find(request => request.id === id)
            if (!request) throw new Error(`Worker ${this.#name} - Request not found: ${id}`)
            this.#requests = this.#requests.filter(request => request.id !== id)
            if (error) request.reject(error)
            else request.resolve(data)
            return
        } else if (type === 'system' && event === 'log') {
            console.log(`Worker ${this.#name} -`, ...data)
            return
        } else if (type === 'system' && event === 'error') {
            console.error(`Worker ${this.#name} -`, ...data)
            return
        } else {
            const { type, event, data } = message
            this.#_on(type, event, data)
        }
        console.log(`Worker ${this.#name} - Received message:`, message)
    }
    #onError(err) {
        console.error(`Worker ${this.#name} - Worker error:`, err, err.message)
    }
    #onExit(code) {
        console.error(`Worker ${this.#name} - Worker exited with code:`, code)
        setTimeout(() => this.restartKill(), 1000)
    }

    // Will not wait for the worker to gracefully shutdown
    async kill() {
        if (this.#worker) {
            this.#worker.removeAllListeners()
            await this.#worker.terminate()
            this.#worker = null
        }
    }

    // Will wait for the worker to gracefully shutdown
    async shutdown() {
        if (this.#worker) {
            try {
                await this.request('super', 'shutdown')
                await this.kill()
            } catch (err) {
                console.error(`Worker ${this.#name} - Shutdown error:`, err)
            }
        }
    }

    // Will instantly restart the worker
    async restartKill() {
        await this.kill()
        this.start()
    }

    // Will wait for the worker to gracefully shutdown and then restart it
    async restart() {
        let killed = false
        const force_kill = setTimeout(() => {
            killed = true
            this.restartKill()
        }, this.#timeout)
        await this.shutdown()
        if (killed) return
        clearTimeout(force_kill)
        this.start()
    }

    /** @param { 'super' | 'user' } type @param { string } event @param { any } [data] */
    async request(type, event, data) {
        this.#i++
        const id = this.#i
        const promise = new Promise((resolve, reject) => {
            if (!this.#worker) throw new Error(`Worker ${this.#name} - Worker not started`)
            this.#requests.push({ id, resolve, reject })
            this.#worker.postMessage({ id, type, event, data })
            // console.log(`Worker ${this.#name} - Sent request:`, { id, type, event, data })
        })
        const time_multiplier_for_super = type === 'super' ? 15 : 1
        const timeout = Timeout(this.#timeout * time_multiplier_for_super)

        // Race the promise with a timeout

        const first = await Promise.race([promise, timeout])
        if (first === '<timeout>') {
            this.#requests = this.#requests.filter(request => request.id !== id)
            throw new Error(`Worker ${this.#name} - Request timeout: ${event}`)
        }

        return first

    }

    /** @param { string } event @param { any } [data] */
    async get(event, ...data) {
        return this.request('user', event, data)
    }

    /** @param { (event: string, data: any) => void | Promise<void> } handler */
    on(handler) {
        this.#_on = handler
    }
}


var task_man_instance = null
class TaskManIPC {

    /** @type { IPCWorker [] } */
    #workers = []

    workerData = workerData

    /** @type { IPCRequestHandler } */
    #_onMasterSystemRequest = (event, message, res, rej) => { }
    /** @type { IPCRequestHandler } */
    #_onMasterRequest = (event, message, res, rej) => { }
    /** @type { IPCRequestHandler } */
    #_onWorkerSystemResponse = (event, message, res, rej) => { }

    /** @type { (name?: string) => TaskManIPC } */
    static getInstance(name) {
        if (task_man_instance) return task_man_instance
        task_man_instance = new TaskManIPC(name)
        return task_man_instance
    }

    /** @param { string } [name] */
    constructor(name) {
        this.master = master
        this.name = (workerData && workerData.name ? workerData.name : '') || name
        console.log(`TaskManIPC ${this.name} - workerData:`, workerData)
        this.id = `TaskManIPC ${name}`
        if (master) {
            // Catch global errors
            process.on('uncaughtException', (err) => console.error(err && err.message ? err.message : err)) // @ts-ignore
            process.on('unhandledRejection', (err) => console.error(err && err.message ? err.message : err))

            master.on('message', (message) => {
                if (message.type === 'super') return this.#onMasterSuper(message)
                if (message.type === 'user') return this.#onMaster(message)
                if (message.type === 'event') return this.send(message.type, message.event, message.data)
                if (message.type === 'log') return console.log(...message.data)
                if (message.type === 'error') return console.error(...message.data)
                throw new Error(`${this.id} parentPort - unknown master message type: ${message.type}`)

            })
            master.on('error', (err) => console.error(`${this.id} parentPort - error:`, err))
            master.on('close', () => console.error(`${this.id} parentPort - closed`))

            console.log = (...args) => this.send('system', 'log', args)
            console.error = (...args) => this.send('system', 'error', args)


            console.log(`${this.id} parentPort - started`)
        }
    }

    /** @param { IPCRequestHandler } handler */ onMasterSystemRequest(handler) { this.#_onMasterSystemRequest = handler }
    /** @param { IPCRequestHandler } handler */ onMasterRequest(handler) { this.#_onMasterRequest = handler }

    /** @param { MasterSuperEventMessage } message */
    async #onMasterSuper(message) {
        if (master) {
            const { id, event, destination, data } = message
            let resolved = false
            const resolve = data => {
                if (resolved) return
                resolved = true
                if (master) master.postMessage({ id, data })
            }
            const reject = error => {
                if (resolved) return
                resolved = true
                if (master) master.postMessage({ id, error })
            }
            if (!destination) { // Target is this instance
                this.#_onMasterSystemRequest(event, data, resolve, reject)
            } else { // Target is a worker downstream
                const name = destination.split('/')[0]
                const worker = this.#workers.find(({ name: n }) => n === name)
                if (!worker) throw new Error(`Worker not found: ${name}`)
                const subDestination = destination.slice(name.length + 1)
                worker.worker.request('super', event, { event, destination: subDestination, data })
                    .then(resolve)
                    .catch(reject)
            }
        }
    }

    /** @param { MasterEventMessage } message */
    #onMaster(message) {
        const { id, event, data } = message
        const resolve = data => master ? master.postMessage({ id, data }) : null
        const reject = error => master ? master.postMessage({ id, error }) : null
        this.#_onMasterRequest(event, data, resolve, reject)
    }

    /** @param { { name: string, path: string, args?: any } } options */
    createWorker(options) {
        const { name, path, args } = options
        const worker = new WorkMan(name, path, args)
        return worker
    }


    request(workerName, event, data) {
        const W = this.#workers.find(({ name }) => name === workerName)
        if (!W) throw new Error(`Worker not found: ${workerName}`)
        const { worker } = W
        return worker.request('user', event, { event, data })
    }

    send(type, event, data) {
        if (master) {
            master.postMessage({ type, event, data })
        } else {
            throw new Error(`Worker ${this.name} - Master not found`)
        }
    }
}

module.exports = TaskManIPC