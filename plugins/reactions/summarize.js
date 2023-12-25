// ./plugins/reactions/summarize.js
const axios = require('axios');

class SummarizePlugin {
  static name = 'eyes'; // The name of the emoji reaction to trigger this plugin

  static async exec(event, client) {
    const thread_ts = event.item.ts;
    const channel_id = event.item.channel;

    // Fetch the thread history
    const history = await this.getThreadHistory(client, channel_id, thread_ts);

    // Format the messages for the OpenAI API
    const messages = history.map(msg => ({
      role: msg.user === event.user ? 'user' : 'assistant', // Slack user is 'user', others are 'assistant'
      content: msg.text
    }));

    // add system prompt to the messages
    messages.push({
      role: 'system',
      content: 'Summarize this thread in max 3 sentences, without losing the context of the conversation. Be short an precise, you may use bullet points. Your goal is to give the reader a quick overview of the conversation.'
    });

    console.log(messages);

    // Send the messages to OpenAI's API
    const summary = await this.getSummaryFromOpenAI(messages);

    // Post the summary back to the thread using blocks
    await client.chat.postEphemeral({
        channel: channel_id,
        thread_ts: thread_ts,
        user: event.user,
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Thread Summary*"
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": summary
            }
          }
        ],
        mrkdwn: true,
      });
    }

  static async getThreadHistory(client, channel, thread_ts) {
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts
    });
    return result.messages;
  }

  static async getSummaryFromOpenAI(messages) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4-1106-preview",
      messages: messages,
      max_tokens: 4096,
      temperature: 0.3,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    // Assume we want to return the content of the last message from the assistant
    return response.data.choices[0].message.content.trim();
  }
}

module.exports = { SummarizePlugin };