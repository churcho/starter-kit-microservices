const debug = require('debug')('application:rabbitmq'.padEnd(25, ' '))

const { Rabbit } = require('rabbit-queue')

const path = require('path')
const glob = require('glob-promise')
const EventEmitter = require('events')
const { inherits } = require('util')

const { getQueues } = require('./Utils')
const Configuration = require('../config')

class RabbitMQ {
  constructor () {
    const options = `amqp://${Configuration.rabbitmq.username}:${Configuration.rabbitmq.password}@${Configuration.rabbitmq.hostname}:${Configuration.rabbitmq.port}`
    this._instance = new Rabbit(options, {
      prefetch: 1, // default prefetch from queue
      replyPattern: false,
      scheduledPublish: false
    })
    this._instance.on('connected', async () => {
      debug('Connected')
      await this.queues()
      this.emit('connected')
    })
    this._instance.on('disconnected', () => {
      this.emit('error', new Error('Rabbitmq Disconnected'))
    })
    EventEmitter.call(this)
  }

  async queues () {
    debug('Detecting queues')
    try {
      const services = glob.sync(`${path.resolve(__dirname, '../services')}/*`)
      if (services.length === 0) { return true }
      do {
        const item = services.shift()
        const basename = path.basename(item)
        const queues = getQueues(`services/${basename}`)
        debug(`Domain ${basename} Queues ${queues.length} detected`)
        if (queues.length > 0) {
          do {
            const queue = queues.shift()
            this.getInstance().createQueue(`${basename}.${queue.name}.Queue`, queue.options, async (msg, ack) => {
              try {
                const action = msg.fields.routingKey.replace('.Key', '')
                console.log(action)
                const params = JSON.parse(msg.content.toString())
                await this.$nats.call(action, params)
                ack(null)
              } catch (err) {
                console.log(err.message)
                ack(err.message)
              }
            }).then(() => debug(`... ${basename}.${queue.name}.Queue created`))
            this.getInstance().bindToTopic(`${basename}.${queue.name}.Queue`, `${basename}.${queue.name}.Key`)
          } while (queues.length > 0)
        }
      } while (services.length > 0)
      return true
    } catch (e) {
      this.emit('error', e)
      return Promise.reject(e)
    }
  }

  getInstance () {
    return this._instance
  }
}

inherits(RabbitMQ, EventEmitter)
module.exports = RabbitMQ
