<p align="center">
  <img src="images/logo.png" alt="NAVBUD logo" width="170" />
</p>

<h1 align="center">NAVBUD</h1>

<p align="center">
  Your own Navigation Buddy!
</p>

## Purpose:

Regular navigation apps don’t have enough safety features for guidance through complex situations.
NAVBUD helps you spot unprotected left turns along a driving route. 

You enter a starting point and a destination. The app builds a route on the map, then highlights left turns that don't have a stoplight. 
The goal is to help drivers notice turns that may need extra caution.

## How it works

1. You type a start and end address.
2. The app builds the driving route using OSRM and reads the step by step maneuvers.
4. It finds the left turn maneuvers on the route.
5. It queries Overpass (OpenStreetMap) for nearby traffic signals around those left turns.
6. If a left turn is close to a traffic signal, it is treated as protected and not highlighted.
7. The remaining left turns are marked on the map as unprotected.

The map UI is built with Leaflet.

## Route history

The app includes a History panel that stores your recent routes.

In the local auth demo, history is saved per signed in user using localStorage, so it comes back when the same user logs in again on the same browser.

## Local AWS Cognito style login demo

This repo includes a local authentication setup inside the `aws_cognito_local` folder.

It is designed as a demo that shows how an AWS Cognito User Pool based login flow can be wired into a simple web app, without paying for AWS services.

How it works:

1. Runs a local Cognito emulator (cognito local).
2. Uses the AWS SDK to create a local User Pool and App Client.
3. Provides `/api/signup` and `/api/login` endpoints from a small Node and Express server.
4. Stores JWT tokens in localStorage.
5. Updates the navbar button to Log in or Log out based on auth state.
6. Saves route history per user while logged in.

In a real AWS deployment, you would replace the local Cognito endpoint with AWS Cognito, configure a real User Pool, App Client settings, and your hosting domain.

## Run the local auth demo

Prereqs:
Node.js installed

Steps:

1. Open a terminal and go into the folder:
   ```bash
   cd aws_cognito_local
2. Install dependencies:
   ```bash
   npm install
3. Start the local cognito emulator:
   ```bash
   npm run cognito
4. In a second terminal, create the local pool and test user config:
   ```bash
   cd aws_cognito_local
   npm run setup
5. Start the web server:
   ```bash
   npm run web
6. Open the app in your browser typically with http://localhost:8000
