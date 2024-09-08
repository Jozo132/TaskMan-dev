// @ts-check
"use strict"

// Inter Process Communication class, used by the master process and the worker processes to communicate with each other
const TaskManIPC = require('./controller.js')

// TaskInstance class, used by the master process and the worker processes
class TaskMan {

    /**
     * @typedef { (callback: Function) => void | Promise<void> } ShutdownHandler
     */
    /** @type { { [event: string]: (...data: any[]) => void | Promise<void> } } */
    #handlers = {}
    /** @type { ShutdownHandler[]} */
    #shutdownHandlers = []

    #name = ''

    /**
     * Create a new TaskWorker instance
     * @param {Object} [options] - The options for the TaskInstance instance
     * @param {string} options.name - The name of the TaskInstance instance
    */
    constructor(options) {
        this.#name = options && options.name ? options.name : 'main'
        this.#handlers = {}

        const ipc = TaskManIPC.getInstance()
        this.ipc = ipc

        this.#name = this.ipc.workerData && this.ipc.workerData.name ? this.ipc.workerData.name : this.#name

        ipc.onMasterSystemRequest(async (event, message, resolve, reject) => {

            if (event === 'shutdown') {
                const promises = this.#shutdownHandlers.map(async handler => {
                    return new Promise((resolve, reject) => {
                        try {
                            handler(() => { resolve(1) })
                        } catch (err) {
                            return reject(err)
                        }
                    })
                })
                const responses = await Promise.allSettled(promises)
                const errors = responses.filter(res => res.status === 'rejected')
                if (errors.length) {
                    console.error('Shutdown error:', errors)
                    return reject(errors)
                }
                return resolve({ message: 'ok' })
            }
            console.log('Master system request', event, message)
            resolve({ message: 'ok' })
        })

        ipc.onMasterRequest(async (event, data, resolve, reject) => {
            //console.log('Master request', event, data)
            // resolve({ message: 'ok' })
            try {
                const handler = this.#handlers[event]
                if (!handler) throw new Error(`No handler for event ${event}`)
                const res = await handler(...data)
                resolve(res)
            } catch (err) {
                reject(err)
            }
        })
    }

    /** @param { { name: string, path: string, args?: any } } options */
    createWorker(options) {
        const { ipc } = this
        const worker = ipc.createWorker(options)
        return worker
    }

    log(...args) {
        // post message to master process
        if (this.ipc.master) this.ipc.send('system', 'log', args)
        else console.log(...args)
    }

    error(...args) {
        // post message to master process
        if (this.ipc.master) this.ipc.send('system', 'error', args)
        else console.error(...args)
    }

    /** @type { (event: string, data: any) => void | Promise<void> } */
    on(event, handler) {
        this.#handlers[event] = handler
    }

    /** @param { ShutdownHandler } handler */
    onShutdown(handler) {
        this.#shutdownHandlers.push(handler)
    }
}


// Export the TaskMan class
module.exports = TaskMan