<div align="center"><a name="readme-top"></a>

<h1>Cohere Slack Chat Bot</h1>

This project wraps https://github.com/slackapi/bolt-js. See official docs for details.

[![][github-contributors-shield]][github-contributors-link]
[![][github-forks-shield]][github-forks-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]

[Changelog](./CHANGELOG.md) · [Report Bug][github-issues-link] · [Request Feature][github-issues-link]

![](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

</div>

> :warning: **Warning**: This project is currently under heavy development and is not yet production-ready. <br>Please use with caution and expect frequent updates and changes.


## ✨ Features

- [x] 💨 **Enhanced Web-Assisted Chat**: Leverage the RAG (Retrieval-Augmented Generation) capability of the Cohere Chat Endpoint for precise, web-sourced responses, complete with cited sources, delivered with exceptional speed;
- [x] 💎 **Efficient Thread Summarization**: Add an "eyes" emoji to any lengthy thread, and engage the OpenAI GPT-4 Chat endpoint for a concise and rapid summary;
- [x] 🗣️ **Seamless Conversation Flow**: Within a thread, seamlessly pose follow-up questions. The Chat Bot maintains awareness of the thread's history, ensuring a coherent and continuous dialogue experience;
- [x] 🌟 **Interactive UI with Slack Message Blocks** Utilize Slack Message Blocks for a dynamic UI, featuring a 'Regenerate' button for instant answer refresh and a dropdown for organized search results.

## Roadmap :world_map:

- [ ] 📡 **Streaming Responses**: Implement real-time streaming for faster and more dynamic chat responses.
- [ ] 👍 **User Feedback Integration**: Enable users to provide direct feedback on chat responses, enhancing AI learning and accuracy.
- [ ] 💬 **Chat via Direct Message**: Expand functionality to allow AI chat interactions through Slack DMs.
- [ ] 🔗 **Enhanced Connector Management**: Integrate more features for managing connectors via Slack, improving connectivity and control.
- [ ] 🚀 **Heroku Hosting Support**: Aim to make the project one-click deploy ready for easy Heroku hosting.


## ✨ Demo
https://github.com/LeEricCH/cohere-slack-starter-app/assets/75225859/1f437203-fe0c-4496-93cb-189191091ade


<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ Local Development
You can clone it for local development:

```bash
$ git clone https://github.com/LeEricCH/cohere-slack-starter-app.git
$ cd cohere-slack-starter-app
$ yarn install
$ yarn serve
```

Create an `.env` file with the following variables:
```
PORT=8000

COHERE_API_TOKEN=xxxx
OPENAI_API_KEY=sk-xxx

SLACK_APP_TOKEN=xapp-xxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx
```

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-black?style=flat-square

## 🔗 Links
### Credits

- **cohere-samples** - <https://github.com/cohere-ai/samples>


[github-release-shield]: https://img.shields.io/github/v/release/LeEricCH/cohere-slack-starter-app?color=369eff&labelColor=black&logo=github&style=flat-square
[github-release-link]: https://github.com/LeEricCH/cohere-slack-starter-app/releases
[github-releasedate-shield]: https://img.shields.io/github/release-date/LeEricCH/cohere-slack-starter-app?labelColor=black&style=flat-square
[github-releasedate-link]: https://github.com/LeEricCH/cohere-slack-starter-app/releases
[github-contributors-shield]: https://img.shields.io/github/contributors/LeEricCH/cohere-slack-starter-app?color=c4f042&labelColor=black&style=flat-square
[github-contributors-link]: https://github.com/LeEricCH/cohere-slack-starter-app/graphs/contributors
[github-forks-shield]: https://img.shields.io/github/forks/LeEricCH/cohere-slack-starter-app?color=8ae8ff&labelColor=black&style=flat-square
[github-forks-link]: https://github.com/LeEricCH/cohere-slack-starter-app/network/members
[github-stars-shield]: https://img.shields.io/github/stars/LeEricCH/cohere-slack-starter-app?color=ffcb47&labelColor=black&style=flat-square
[github-stars-link]: https://github.com/LeEricCH/cohere-slack-starter-app/network/stargazers
[github-issues-shield]: https://img.shields.io/github/issues/LeEricCH/cohere-slack-starter-app?color=ff80eb&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/LeEricCH/cohere-slack-starter-app/issues
[github-license-shield]: https://img.shields.io/github/license/LeEricCH/cohere-slack-starter-app?color=white&labelColor=black&style=flat-square
[github-license-link]: https://github.com/LeEricCH/cohere-slack-starter-app/blob/master/LICENSE
