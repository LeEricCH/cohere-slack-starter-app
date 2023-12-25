// app/conversation.js

const cohere = require("cohere-ai");

const handleConversation = async (command, client, thread_ts) => {
  cohere.init(process.env.COHERE_API_TOKEN);
  const history = await getThreadHistory(client, command.channel_id, thread_ts);
  const chat_history = history.map((msg) => ({
    role: msg.user === command.user_id ? 'USER' : 'ASSISTANT',
    message: msg.text
  }));

  const cohereResponse = await cohere.chat({
    model: 'command',
    chat_history,
    message: command.text
  });

  if (cohereResponse.statusCode !== 200) {
    throw new Error(`${cohereResponse.statusCode} received from Cohere API`);
  }

  await client.chat.postMessage({
    channel: command.channel_id,
    thread_ts: thread_ts,
    text: cohereResponse.body.message
  });
};

const getThreadHistory = async (client, channel, thread_ts) => {
  const result = await client.conversations.replies({
    channel: channel,
    ts: thread_ts
  });
  return result.messages;
};

module.exports = {
  handleConversation,
  getThreadHistory,
};