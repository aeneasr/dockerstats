import React, { Component } from 'react'
import { stats } from '../helper'
import {
  Paper,
  StyledComponentProps,
  Theme,
  Typography,
  withStyles,
} from '@material-ui/core'
import numeral from 'numeral'
import {
  createContainer,
  VictoryArea,
  VictoryAxis,
  VictoryBrushContainer,
  VictoryChart,
  VictoryGroup,
  VictoryLabel,
  VictoryLegend,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory'
import { DomainTuple } from 'victory-core'

interface PropTypes extends StyledComponentProps {
  org: string
  repo: string
}

interface Item {
  timestamp: number
}

interface StateTypes {
  data: Item[]
  fetched: boolean
  zoomDomain: { x?: DomainTuple; y?: DomainTuple }
}

const formatNumber = (n: number) => numeral(n).format('0.0a')

const formatTimestamp = (ts: number) => {
  const date = new Date(ts)
  return `${date.getUTCFullYear()}-${
    date.getUTCMonth() + 1
  }-${date.getUTCDate()}`
}

const styles = (theme: Theme) => ({
  container: {
    padding: '24px 24px 32px 24px',
    boxShadow: '0px 0px 64px rgba(34, 186, 251, 0.1)',
  },
  warning: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.error.light,
    color: theme.palette.common.white,
  },
})

const AdvancedContainer: any = createContainer('zoom', 'voronoi')

class Chart extends Component<PropTypes, StateTypes> {
  state = {
    data: [],
    fetched: false,
    zoomDomain: { x: [new Date(2019, 1, 1), new Date()] } as any,
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

    return stats({ org, repo })
      .then((body) =>
        this.setState(() => ({
          fetched: true,
          data: body.map(({ timestamp, ...rest }: any) => ({
            ...rest,
            // label: formatNumber(rest.pull_count),
            timestamp: new Date(timestamp).getTime(),
          })),
        }))
      )
      .catch(console.error)
  }

  handleZoom(domain: any) {
    this.setState({ zoomDomain: domain })
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
              href={`https://hub.docker.com/v2/repositories/${this.props.org}/${this.props.repo}/`}
            >
              here
            </a>
            . If you see an error, the repository does not exist.
          </Typography>
        </Paper>
      )
    }

    const lastItem = this.state.data[this.state.data.length - 1] as any
    const maxY = lastItem.pull_count + lastItem.pull_count / 20

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
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <VictoryGroup
              scale={{
                x: 'time',
              }}
              padding={{ left: 0, top: 50, right: 70, bottom: 40 }}
              height={540}
              width={1264}
              maxDomain={{ y: maxY }}
              containerComponent={
                <VictoryVoronoiContainer
                  // zoomDimension="x"
                  responsive
                  // zoomDomain={this.state.zoomDomain}
                  // onZoomDomainChange={this.handleZoom.bind(this)}
                />
              }
            >
              <VictoryArea
                style={{
                  data: {
                    fill: 'rgba(11, 243, 243, 0.13)',
                    stroke: '#015B8D',
                  },
                }}
                labels={({ datum }) =>
                  `${formatTimestamp(datum.timestamp)}: ${formatNumber(
                    datum.pull_count
                  )}`
                }
                labelComponent={
                  <VictoryTooltip
                    flyoutStyle={{ strokeWidth: 0, fillOpacity: 0.95 }}
                    style={{ fontSize: 16 }}
                    constrainToVisibleArea
                  />
                }
                data={this.state.data}
                maxDomain={{ y: maxY }}
                minDomain={{ y: 0 }}
                padding={{ top: 5 }}
                x="timestamp"
                y="pull_count"
              />
              <VictoryAxis
                dependentAxis
                maxDomain={{ y: maxY }}
                tickFormat={(pull_count) => formatNumber(pull_count)}
                style={{
                  tickLabels: { fontSize: 16 },
                  axis: { stroke: '#756f6a' },
                  axisLabel: { fontSize: 40, padding: '120 0 0 0' },
                }}
                orientation="right"
              />
              <VictoryAxis
                style={{ tickLabels: { fontSize: 16 } }}
                orientation="bottom"
              />
            </VictoryGroup>
          </div>
        </Paper>
      </>
    )
  }
}

export default withStyles(styles)(Chart)
