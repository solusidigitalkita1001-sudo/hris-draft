import amqp, { ChannelModel, ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';

type MessageHandler<T = unknown> = (payload: T, message: ConsumeMessage) => Promise<void>;

export class RabbitMQBroker {
  private static instance: RabbitMQBroker;
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connectPromise?: Promise<void>;
  private readonly healthTimeoutMs: number = 1000;

  private constructor() {}

  static getInstance(): RabbitMQBroker {
    if (!RabbitMQBroker.instance) {
      RabbitMQBroker.instance = new RabbitMQBroker();
    }

    return RabbitMQBroker.instance;
  }

  async connect(): Promise<void> {
    if (!config.rabbitmq.enabled) {
      return;
    }

    if (this.channel) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });

      this.connection.on('error', (error) => {
        logger.error('RabbitMQ connection error', { error });
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.connection = undefined;
        this.channel = undefined;
        this.connectPromise = undefined;
      });

      logger.info('RabbitMQ connection established', {
        exchange: config.rabbitmq.exchange,
      });
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  async publish<T>(routingKey: string, payload: T, options?: Options.Publish): Promise<void> {
    if (!config.rabbitmq.enabled) {
      return;
    }

    await this.connect();

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    this.channel.publish(
      config.rabbitmq.exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        type: routingKey,
        ...options,
      }
    );

    await this.channel.waitForConfirms();
  }

  async subscribe<T = unknown>(
    queueName: string,
    bindingKeys: string[],
    handler: MessageHandler<T>
  ): Promise<void> {
    if (!config.rabbitmq.enabled) {
      return;
    }

    await this.connect();

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.prefetch(config.rabbitmq.prefetch);

    for (const bindingKey of bindingKeys) {
      await this.channel.bindQueue(queueName, config.rabbitmq.exchange, bindingKey);
    }

    await this.channel.consume(queueName, async (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString()) as T;
        await handler(payload, message);
        this.channel?.ack(message);
      } catch (error) {
        logger.error('RabbitMQ consumer failed', {
          queueName,
          error,
        });
        this.channel?.nack(message, false, false);
      }
    });

    logger.info('RabbitMQ consumer registered', {
      queueName,
      bindingKeys,
    });
  }

  async isHealthy(): Promise<boolean> {
    if (!config.rabbitmq.enabled) {
      return true;
    }

    try {
      await Promise.race([
        this.connect(),
        new Promise<'TIMEOUT'>((resolve) =>
          setTimeout(() => resolve('TIMEOUT'), this.healthTimeoutMs)
        ),
      ]);
      return !!this.channel;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = undefined;
    this.connection = undefined;
    this.connectPromise = undefined;
    logger.info('RabbitMQ connection closed');
  }
}

export const rabbitMQBroker = RabbitMQBroker.getInstance();
