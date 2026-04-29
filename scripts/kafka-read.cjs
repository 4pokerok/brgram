const { Kafka } = require("kafkajs");

const BROKER = process.env.KAFKA_BROKERS || "94.139.255.96:9094";
const TOPIC = process.env.KAFKA_TOPIC || "validations";
const GROUP = process.env.KAFKA_GROUP_ID || `debug-${Date.now()}`;

async function start() {
  const kafka = new Kafka({
    clientId: "debug-reader",
    brokers: [BROKER],
    connectionTimeout: 10000,
    requestTimeout: 60000,
    retry: { retries: 100000, initialRetryTime: 1000, maxRetryTime: 30000 }
  });

  const c = kafka.consumer({ groupId: GROUP });

  while (true) {
    try {
      await c.connect();
      await c.subscribe({ topic: TOPIC, fromBeginning: false });
      console.log("listening topic:", TOPIC, "group:", GROUP, "broker:", BROKER);

      await c.run({
        eachMessage: async ({ message }) => {
          console.log("key:", message.key?.toString());
          console.log("value:", message.value?.toString());
          console.log("----");
        }
      });

      break;
    } catch (e) {
      console.error("reader error, retry in 5s:", e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

start();
