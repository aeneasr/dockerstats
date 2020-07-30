import React, { ChangeEvent, Component, KeyboardEvent } from 'react'
import { Grid } from '@material-ui/core'
import { RouteComponentProps } from 'react-router'
import Chart from '../Chart'
import { stats } from '../helper'
import Input from './Input'

type PathParams = {
  org: string
  repo: string
}

interface PropTypes extends RouteComponentProps<PathParams> {}

interface StateTypes {
  input: string
  org: string
  repo: string
  error: boolean
}

class Statistics extends Component<PropTypes, StateTypes> {
  state = {
    input: '',
    org: '',
    repo: '',
    error: false,
  }

  onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const parts = this.state.input.split('/')
    let error = true
    if (parts.length === 2) {
      error = false
    }
    this.setState(() => ({ input, error }))
  }

  componentDidMount(): void {
    let { org = '' } = this.props.match.params
    const { repo = '' } = this.props.match.params
    if (!org || !repo) {
      return
    }

    if (org === '_') {
      org = 'library'
    }

    this.setState(() => ({ input: `${org}/${repo}`, org, repo }))
  }

  fetch(org: string, repo: string) {
    return stats({org,repo}).catch(console.error)
  }

  go = () => {
    const parts = this.state.input.split('/')
    if (parts.length === 2) {
      this.setState({ error: false })
      const org = parts[0]
      const repo = parts[1]
      this.props.history.push(`/hubs/docker/${org}/${repo}`)
    } else {
      this.setState({ error: true })
    }
  }

  onKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.go()
    }
  }

  render() {
    const {
      match: {
        params: { org, repo },
      },
    } = this.props
    const { input, error } = this.state

    return (
      <div>
        <Grid container>
          <Grid item xs={12}>
            <Input
              value={input}
              onChange={this.onChange}
              onKeyPress={this.onKeyPress}
              error={error}
              onDone={this.go}
            />
          </Grid>
        </Grid>
        <Grid container>
          <Grid item xs={12}>
            <Chart org={org} repo={repo} />
          </Grid>
        </Grid>
      </div>
    )
  }
}

export default Statistics
