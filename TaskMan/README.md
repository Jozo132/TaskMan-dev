#   TaskMan.js is a master/worker process manager for Node.js
#   It is designed to manage a pool of worker processes that can be used to perform tasks in parallel.
#   It is able to forward tasks to the workers, and return the results to the master process.
#   It is also able to monitor the workers and restart them if they crash, while also being able to shut them down gracefully.
#   The master process is able to communicate with the workers using IPC (Inter-Process Communication).
#   The workers are able to communicate with the master process using IPC.
#   The workers are able to spawn their own child processes in a tree-like structure.
#   TaskMan.js has the ability, to monitor and manage all subprocesses in the tree, which makes it possible to hot-reload workers while the upstream workers are still running without any downtime.
#   TaskMan.js is able to manage the lifecycle of the workers down the tree, and can be used to start, stop, restart, and reload them.


# Usage for the master process: 
```js
// ############################################################################################
const TaskMan = require('./TaskMan.js') // Import the TaskMan module

const instance = new TaskMan({ name: 'main' }) // Create a new TaskMan instance with the name 'main'// Start up the worker processes
const worker_a = instance.createWorker({ name: 'worker_a', type: 'node', path: 'worker_x.js', args: [] }) // Create a new worker process with the name 'workera' and the path 'worker_x.js'

const worker_b = instance.createWorker({ name: 'worker_b', type: 'node', path: 'worker_x.js', args: [] }) // Create a new worker process with the name 'worker_b' and the path 'worker_x.js'
// Start supervisor process for this instance to monitor the instance and all the workers in the downstream tree
instance.serve(6942, (err)=> {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.log('TaskMan supervisor server listening on port 3000')

})
const express = require('express')

const app = express()
// Forward all requests starting with '/a' to worker_a


app.get('/a/*', worker_a.middleware())// Forward a single request to worker_b
app.get('/b/:id', async (req, res) => {
   const result = await worker_b.request('/:id', { id: req.params.id }) // Send a task to worker_b
   res.json(result)
})

app.listen(3000, () => {
   console.log('Main server listening on port 3000')
})
// ############################################################################################
```




# Usage for the worker process:
```js
// ############################################################################################
const TaskMan = require('./TaskMan.js') // Import the TaskMan module
const instance = new TaskMan({ name: 'worker' }) // Create a new TaskMan instance with the name 'worker'

// Handle all requests starting with '/:id'
instance.on('/:id', async (input) => {
    return { id: input.id + 1 }
})

instance.onShutdown(confirm => {
   console.log('Worker received shutdown signal, confirming after 1 second ...')
   setTimeout(() => { confirm() }, 1000)
})

// ############################################################################################
```