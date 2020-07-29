import { Component } from 'react'
import { RouteComponentProps } from 'react-router'

interface PropTypes extends RouteComponentProps {}

const repos = [
  'library/couchbase',
  'library/mysql',
  'library/postgres',
  'library/redis',
  'library/busybox',
  'library/ubuntu',
  'library/node',
  'library/golang',
  'library/alpine',
  'library/registry',
  'library/hello-world',
  'library/mongo',
  'library/nginx',
  'library/consul',
  'library/debian',
  'library/httpd',
]

class NoMatch extends Component<PropTypes> {
  componentDidMount(): void {
    console.log(
      'pushing',
      `/hubs/docker/${repos[Math.floor(Math.random() * repos.length)]}`
    )
    this.props.history.push(
      `/hubs/docker/${repos[Math.floor(Math.random() * repos.length)]}`
    )
  }

  render() {
    return null
  }
}

export default NoMatch
