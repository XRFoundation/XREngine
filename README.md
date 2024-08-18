# Ethereal Engine is now Infinite Reality Engine and has been moved!

## You can find the project now at https://github.com/ir-engine/ir-engine

![iR Square Black Small](https://github.com/EtherealEngine/etherealengine/assets/5104160/51d93122-3325-46d9-b111-2562fd8802c1)

>  Manifest your dreams on the open social spatial web.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Background](#background)
- [Demos](#demos)
- [Project API](#project-api)
  - [Library of EE Projects](#library-of-ee-projects)
  - [Create your own projects](#create-your-own-projects)
- [Launch iR Engine with Control Center Install - ***RECOMMENDED***](#launch-ethereal-engine-with-control-center-install---recommended)
  - [Use Metaverse Control Plane Managment GUI](#use-metaverse-control-plane-managment-gui)
- [Advanced Development Install](#advanced-development-install)
  - [Pre-Requisites](#pre-requisites)
  - [Getting Started](#getting-started)
- [Usage](#usage)
  - [Documentation](#documentation)
- [Contributing](#contributing)
  - [Let's build it together](#lets-build-it-together)
  - [Join our Discord  ](#join-our-discord--)
  - [Sponsorship ](#sponsorship-)
- [License](#license)

## Background

https://user-images.githubusercontent.com/507127/142818955-51d7757f-a432-45da-8f8f-56037358ad58.mp4

We ([Infinite Reality Engine](https://github.com/etherealengine)) believe that the Metaverse, 
Web AR, VR, and XR should be easy.

We want a Star Trek future where participating in immersive communication 
technology and shared simulations should be as easy and natural as making a website.

- Includes a self-deployable platform, UI, worlds, avatars, and games
- Fully customizable for any kind of game, social experience, event or spatial web app
- User management, avatars and inventory with optional blockchain integration (see our Blockchain-in-a-Box repo)
- Social features like chat, groups, friends, blocking and moderation
- Complete world editing and administration
- 2D, 3D and XR Avatars with full inverse kinematics and facial expressions
- Fully networked physics using Rapier Physics
- Voice and video over WebRTC
- Instant login and location sharing with phone number or email
- Modular- Use the engine, server, client, editor and scalable devops infrastructure as needed
- OAuth login with Facebook, Google, Steam, Github or instant login with email or phone
- WebGL client deployable to iOS, Android and desktop
- Free, open source, CPAL licensed

## Demos

Guest Demos

- ***[Apartment - CCO from Sketchfab](https://app.etherealengine.com/location/apartment)***
- ***[Star Station - our dev coommunity hangout](https://app.etherealengine.com/location/sky-station)***
- ***[Globe Concert Hall - collab with WildCapture.io](https://app.etherealengine.com/location/globe-theater)***


Host Demos 

- [Admin Console - Demo Cluster - Request Demo Access on our Discord](https://demo.etherealengine.com/admin)
- [iR Studio - Demo Cluster - Request Demo Access on our Discord](https://demo.etherealengine.com/studio)

## Project API

### [Library of EE Projects](https://github.com/EtherealEngine/project-manifest)

Create composable plug-ins for iR Engine experiences with the Projects API

### [Create your own projects](https://etherealengine.github.io/etherealengine-docs/docs/manual/creator/project/intro)

## Launch iR Engine with Control Center Install - ***RECOMMENDED***

### [Use Metaverse Control Plane Managment GUI](https://github.com/etherealengine/etherealengine-Control-Center)

Best for simple self hosting, advanced editor content creation, and XRProject Pack Project development.

## Advanced Development Install

### Pre-Requisites

To install iR Engine locally, the following pre-reqs are required.

* Linux (many of us develop on Ubuntu), Mac OS X, or Windows (we recommend WSL2)
* Node.js v16 or later (we recommend installing via [`nvm`](https://github.com/nvm-sh/nvm)
  or [`asdf`](https://github.com/asdf-vm/asdf).)
* C++ (for `node-gyp`), Python >=3.6 + [PIP](https://pypi.org/project/pip/), `make`
  and other build tools, for compiling Mediasoup.
  Although most of iR Engine is written in TypeScript, it uses a [Mediasoup](https://mediasoup.org/)
  engine for WebRTC conferencing. See the [Mediasoup install instructions](https://mediasoup.org/documentation/v3/mediasoup/installation/)
  for more details.
* Docker. (Although Docker is technically optional, running iR Engine requires starting up
  half a dozen different services, and using Docker Compose will make your life dramatically
  easier.)
* MariaDB and Redis. (If you're using Docker, containers for MariaDB and Redis 
  will automatically be started up.)

### Getting Started

See the [Installation instructions](https://etherealengine.github.io/etherealengine-docs/manual/install/)
for more details.

## Usage

### Documentation

* [General iR Engine documentation](https://etherealengine.github.io/etherealengine-docs/docs)
* [Auto-generated (typedoc) API reference](https://etherealengine.github.io/etherealengine-docs/typedoc/)
* [Avatar](https://etherealengine.github.io/etherealengine-docs/docs/manual/creator/avatars/intro), [Scene](https://etherealengine.github.io/etherealengine-docs/docs/manual/creator/project/intro) & [Asset Pipeline](https://etherealengine.github.io/etherealengine-docs/docs/manual/creator/assets/intro)
* [Why are we building iR Engine?](https://etherealengine.github.io/etherealengine-docs/docs/)

## Contributing

* We expect contributors and community members to follow our
  [Code of Conduct](CODE_OF_CONDUCT.md).
* See the **[Contributing Guide](CONTRIBUTING.md)** and corresponding
  [wiki entry](https://github.com/EtherealEngine/etherealengine/wiki/Testing-&-Contributing)
  for more details.
* Version numbering of the iR Engine monorepo follows the
  [Semantic versioning](http://semver.org/) approach.
* We use the [Prettier.io](https://prettier.io/) formatter for our code style.
* [Standard Readme](https://github.com/RichardLitt/standard-readme) for
  the README structure.

### Let's build it together

We believe that projects like this are extremely complex and difficult, and can 
only be built when large groups of people work together, out in the open. If you 
believe that your calling is to build a free, open network that everyone, 
everywhere can get value from, then you are welcome in our community, and we'll 
do our best to get you set up.

We are always hiring talented people who want to be leaders in what is to come. 
Inquire with anyone who seems like they know what's going on and they'll help 
you find who you need to talk to.

![msf-member-badge-small](https://user-images.githubusercontent.com/5104160/181168132-57a91f8b-16c9-45f0-a0ee-c89f8f018a80.png)

### [Join our Discord](https://discord.gg/xrf)  [![Discord Chat](https://img.shields.io/discord/692672143053422678.svg)](https://discord.gg/xrf)

### [Sponsorship](https://opencollective.com/etherealengine) [![Open Collective](https://opencollective.com/etherealengine/tiers/badge.svg)](https://opencollective.com/etherealengine)

## License
[CPAL](LICENSE) - Copyright (c) 2021-2024 Infinite Reality.
iR Engine, formerly known as Ethereal Engine and XREngine

If you wish to use iR Engine under the open-source CPAL license, attribution is required. 
Please see attribution guidelines in the [LICENSE](LICENSE) file.
Other licensing options are available, please contact us for more information.

[Release History and Author Archive](/HISTORY.md)
