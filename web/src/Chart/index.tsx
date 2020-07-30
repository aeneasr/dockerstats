import React, { Component } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { stats} from '../helper'
import {
  StyledComponentProps,
  Theme,
  Typography,
  withStyles,
  Paper,
} from '@material-ui/core'
import numeral from 'numeral'

interface PropTypes extends StyledComponentProps {
  org: string
  repo: string
}

interface StateTypes {
  data: any[]
  fetched: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active) {
    return (
      <Paper style={{ padding: '6px 8px' }}>
        <Typography variant={'body2'}>
          {formatTimestamp(label)}: {payload[0].value}
        </Typography>
      </Paper>
    )
  }

  return null
}

const formatNumber = (n: number) => numeral(n).format('0.0a')

const formatTimestamp = (ts: number) => {
  const date = new Date(ts)
  return `${date.getUTCFullYear()}-${date.getUTCMonth() +
    1}-${date.getUTCDate()}`
}

const styles = (theme: Theme) => ({
  container: {
    padding: '56px 24px 32px 24px',
    paddingRight: 24,
    boxShadow: '0px 0px 64px rgba(34, 186, 251, 0.1)'
  },
  warning: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.error.light,
    color: theme.palette.common.white,
  },
})

class Chart extends Component<PropTypes, StateTypes> {
  state = {
    data: [],
    fetched: false,
  }

  componentDidMount(): void {
    let { org = '' } = this.props
    if (org === '_') {
      org = 'library'
    }

    this.fetch({ org, repo: this.props.repo })
  }

  componentWillReceiveProps(
    nextProps: Readonly<PropTypes>,
    nextContext: any
  ): void {
    if (
      this.props.org !== nextProps.org ||
      this.props.repo !== nextProps.repo
    ) {
      let { org = '' } = nextProps
      if (org === '_') {
        org = 'library'
      }

      this.fetch({ org, repo: nextProps.repo })
    }
  }

  fetch({ org, repo }: PropTypes) {
    if (!org || !repo) {
      return
    }

    return stats({org,repo})
      .then(body =>
        this.setState(() => ({
            fetched: true,
            data: body.map(({ timestamp, ...rest }: any) => ({
                ...rest,
                timestamp: new Date(timestamp).getTime(),
              }))
          })
        ))
      .catch(console.error)
  }

  render() {
    const { classes = {} } = this.props

    if (!this.state.fetched) {
      return null
    }

    if (this.state.data.length === 0) {
      return (
        <Paper className={classes.warning}>
          <Typography variant="body1">
            This repository either does not exist or has not been fetched yet.
            To check if the repository exists, click{' '}
            <a
              href={`https://hub.docker.com/v2/repositories/${this.props.org}/${
                this.props.repo
              }/`}
            >
              here
            </a>
            . If you see an error, the repository does not exist.
          </Typography>
        </Paper>
      )
    }

    return (
      <>
        {this.state.data.length < 25 && (
          <Paper className={classes.warning}>
            <Typography variant="body1">
              It appears that this repository has few data points. Check back in
              a couple of days.
            </Typography>
          </Paper>
        )}
        <Paper className={classes.container}>
          <div style={{ width: '100%', height: '30vh' }}>
            <ResponsiveContainer width={'99%'}>
              <AreaChart data={this.state.data}>
                <XAxis
                  dataKey="timestamp"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={formatTimestamp}
                  type="number"
                  tickCount={12}
                  // interval={'preserveStartEnd' as 'preserveStartEnd'}
                />
                <YAxis
                  padding={{ top: 0, bottom: 0 }}
                  type="number"
                  orientation={'right'}
                  domain={[0, 'auto']}
                  tickFormatter={formatNumber}
                  tickLine={false}
                  axisLine={false}
                  tickCount={5}
                />
                <CartesianGrid
                  stroke="rgba(1,91,141,0.15)"
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={true}
                />
                <Tooltip content={CustomTooltip} />
                <Area
                  type="monotone"
                  dataKey="pull_count"
                  name="Total Image Pulls"
                  stroke="#015B8D"
                  fill="rgba(11, 243, 243, 0.13)"
                  dot={() => null}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Paper>
      </>
    )
  }
}

export default withStyles(styles)(Chart)
