import amql from "amqplib";

let channel: amql.Channel;

export const connectRabbitMQ = async () => {
  const maxRetries = 10;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const connection = await amql.connect({
        protocol: "amqp",
        hostname: process.env.Rabbitmq_Host,
        port: 5672,
        username: process.env.Rabbitmq_Username,
        password: process.env.Rabbitmq_Password,
      });

      channel = await connection.createChannel();

      console.log("Connected to rabbitmq");
      return;
    } catch (error) {
      attempts++;
      console.log(
        `Failed to connect to rabbitmq. Retry ${attempts}/${maxRetries}`,
      );

      await new Promise((res) => setTimeout(res, 5000));
    }
  }

  console.log("Could not connect to rabbitmq after retries");
};

export const publishToQueue = async (queueName: string, message: any) => {
  if (!channel) {
    console.log("Rabbitmq channel is not initalized");
    return;
  }

  await channel.assertQueue(queueName, { durable: true });

  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};
