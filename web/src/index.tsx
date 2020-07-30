import React from 'react'
import Router from './Router'
import * as serviceWorker from './serviceWorker'
import { hydrate, render } from 'react-dom'

// if (
//     (
//         window.location.hostname !== 'www.dockerstats.com'
//         && window.location.hostname !== 'localhost'
//         && window.location.hostname !== '127.0.0.1'
//     )
//     ||
//     (
//         window.location.hostname === 'www.dockerstats.com'
//         && window.location.protocol !== 'https:'
//     )
// ) {
//     window.location.href = 'https://www.dockerstats.com/'
// }

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Could not find element #root.')
}

if (rootElement.hasChildNodes()) {
  hydrate(<Router />, rootElement)
} else {
  render(<Router />, rootElement)
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
