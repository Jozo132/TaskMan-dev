// @ts-check
"use strict"


const TaskMan = require('./TaskMan/index.js') // Import the TaskMan module

// Create a new TaskMan instance with the name 'main'
const instance = new TaskMan({ name: 'worker_string_get' })

instance.on('string', () => 'Hello, World!')


const randomString = (length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
    let result = ''
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
}

instance.on('random_string', (length, charset) => randomString(length, charset))