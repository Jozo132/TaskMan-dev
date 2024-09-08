// @ts-check
"use strict"


const TaskMan = require('./TaskMan/index.js') // Import the TaskMan module

// Create a new TaskMan instance with the name 'main'
const instance = new TaskMan({ name: 'worker_test' })

const worker_string_gen = instance.createWorker({ name: 'worker_string_gen', path: './worker_string_gen.js' })
worker_string_gen.start()

let i = 1

console.log('Worker started')


instance.on('counter', () => i)

instance.on('string', (x) => worker_string_gen.get('string', x))
instance.on('random_string', (x, y) => worker_string_gen.get('random_string', x, y))

const print = () => console.log('Worker test', i++)
print()
setInterval(print, 1000)


instance.onShutdown(confirm => {
    console.log('Worker received shutdown signal, confirming after 15 second ...')
    setTimeout(() => { confirm() }, 5000)
    confirm()
})