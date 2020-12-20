import { Component } from 'react'
import { RouteComponentProps } from 'react-router'

interface PropTypes extends RouteComponentProps {}

const repos = [
  'library/golang',
  'library/registry',
  'library/hello-world',
  'library/consul',
  'library/debian',
  'oryd/hydra',
  'oryd/kratos',
  'oryd/keto',
  'oryd/oathkeeper',
]

class NoMatch extends Component<PropTypes> {
  componentDidMount(): void {
    this.props.history.replace(
      `/hubs/docker/${repos[Math.floor(Math.random() * repos.length)]}`
    )
  }

  render() {
    return null
  }
}

export default NoMatch
