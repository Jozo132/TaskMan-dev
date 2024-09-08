// @ts-check
"use strict"

const moment = require('moment')

const timestamp = () => moment().format('YYYY-MM-DD HH:mm:ss.SSS')

const console_log = console.log
console.log = (...args) => console_log(`[${timestamp()}]:`, ...args)

const delay = ms => new Promise(r => setTimeout(r, ms))

module.exports = {
    delay,
    timestamp
} 