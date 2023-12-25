module.exports = {
    slackConfig: {
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    },
    cohereApiKey: process.env.COHERE_API_TOKEN,
    port: process.env.PORT || 8000,
  };