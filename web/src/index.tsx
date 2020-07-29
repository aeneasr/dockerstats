import React from 'react'
import ReactDOM from 'react-dom'
import Router from './Router'
import * as serviceWorker from './serviceWorker'

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

ReactDOM.render(<Router/>, document.getElementById('root'))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
