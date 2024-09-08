// @ts-check
"use strict"

const helper = require('./helper.js') // Import the helper module (adds timestamp to console output)

const TaskMan = require('./TaskMan/index.js') // Import the TaskMan module

// Create a new TaskMan instance with the name 'main'
const instance = new TaskMan({ name: 'main' })


const worker_a = instance.createWorker({ name: 'worker_a', path: './worker_test.js', args: ['--name=worker_a'] })

worker_a.start()


console.log('Main process started')

let cnt = 0
let last_time = Date.now()
let requesting_counter = false
const test = async () => {
    while (1) {
        if (requesting_counter) return
        requesting_counter = true
        // console.log('Requesting worker_a counter...')
        try {
            // const res = await worker_a.get('counter')
            const res = (await worker_a.get('random_string', 50000, 'abc')).substring(0, 10)
            cnt++
            const count_period = 1_000
            if (cnt % count_period === 0) {
                const now = Date.now()
                const elapsed = now - last_time
                const rate = (count_period / elapsed * 1000).toFixed(2) + ` req/s`
                console.log('worker_a counter:', res, 'cnt:', cnt, 'time:', elapsed, 'rate:', rate)
                last_time = now
            }
            // console.log('worker_a counter:', res)
        } catch (err) {
            console.error('Error requesting worker_a counter:', err)
        }
        requesting_counter = false
        // await delay(1000)
    }
}

test()


// let restarting = false
// setInterval(async () => {
//     if (restarting) return
//     restarting = true
//     console.log('Restarting worker_a...')
//     // setTimeout(() => restarting = false, 5000)
//     await worker_a.restart()
//     restarting = false
// }, 6000)