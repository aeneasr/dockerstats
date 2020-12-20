import React, { Component } from 'react'
import { repos, stats } from '../helper'
import {
  Paper,
  StyledComponentProps,
  Theme,
  Typography,
  withStyles,
} from '@material-ui/core'
import numeral from 'numeral'
import {
  VictoryArea,
  VictoryAxis,
  VictoryGroup,
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
  pull_count: number
  star_count: number
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

const toDayTimestamp = (ts: any) =>
  new Date(
    new Date(ts).getUTCFullYear(),
    new Date(ts).getUTCMonth(),
    new Date(ts).getUTCDate(),
    0,
    0,
    0
  ).getTime()

const normalizeTimestamps = (items: Item[]) =>
  items.map(({ timestamp, ...rest }: any) => ({
    ...rest,
    timestamp: toDayTimestamp(timestamp),
  }))

const fillBlanks = (items: Item[]) => {
  if (!items.length) {
    return items
  }

  const results: Item[] = []
  const start = new Date(items[0].timestamp)
  const end = new Date(items[items.length - 1].timestamp)

  let lastItem: Item = items[0]
  let lastIndex = 0
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const index = items.findIndex(
      (item) => new Date(item.timestamp).getTime() === day.getTime()
    )
    if (index === -1) {
      if (items.length - 1 < lastIndex + 1) {
        // Skip last element
        break
      }

      const nextItem = items[lastIndex + 1]
      const m =
        (nextItem.pull_count - lastItem.pull_count) /
        (new Date(nextItem.timestamp).getTime() -
          new Date(lastItem.timestamp).getTime())
      const t = lastItem.pull_count - m * new Date(lastItem.timestamp).getTime()
      const estimate = Math.round(m * day.getTime() + t)

      if (isNaN(estimate)) {
        results.push({
          ...lastItem,
          timestamp: day.getTime(),
        })
      } else {
        results.push({
          ...lastItem,
          pull_count: estimate,
          timestamp: day.getTime(),
        })
      }
    } else {
      lastItem = items[index]
      lastIndex = index
      results.push(items[index])
    }
  }

  return results
}

const sortItems = (a: Item, b: Item) =>
  a.timestamp > b.timestamp ? 1 : b.timestamp > a.timestamp ? -1 : 0

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
    if (org && repo) {
      return stats({ org, repo })
        .then((body) => {
          this.setState((state) => ({
            ...state,
            fetched: true,
            data: fillBlanks(normalizeTimestamps(body)),
          }))
        })
        .catch(console.error)
    } else if (org) {
      return repos({ org }).then(({ results }) => {
        return Promise.all(
          results.map(({ user, name }) => stats({ org: user, repo: name }))
        )
          .then((imageStats: Item[][]) => {
            let lastDay = new Date(0, 0, 0, 0, 0, 1)
            let firstDay = new Date(9999, 0, 0, 0, 0)

            let images = imageStats
              .filter((items) => items.length > 0)
              .map((items: Item[]) => normalizeTimestamps(items))
              .map((items: Item[], key) => {
                items.forEach((item) => {
                  if (new Date(item.timestamp) < firstDay) {
                    firstDay = new Date(item.timestamp)
                  }
                  if (new Date(item.timestamp) > lastDay) {
                    lastDay = new Date(item.timestamp)
                  }
                })
                return fillBlanks(items)
              })
              .map((items: Item[]) => {
                const lastItem = items[items.length - 1]
                let result = items
                for (
                  let day = new Date(firstDay);
                  day <= lastDay;
                  day.setDate(day.getDate() + 1)
                ) {
                  if (new Date(items[0].timestamp) > day) {
                    result = [
                      {
                        pull_count: 0,
                        star_count: 0,
                        timestamp: day.getTime(),
                      },
                      ...result,
                    ]
                  }
                  if (new Date(lastItem.timestamp) < day) {
                    result = [
                      ...result,
                      { ...lastItem, timestamp: day.getTime() },
                    ]
                  }
                }
                result = result.sort(sortItems)
                return result
              })
              .reduce((acc, current, index) => {
                if (index === 0) {
                  return [...acc, ...current]
                }

                return acc.map((item, k) => {
                  if (item.timestamp !== current[k].timestamp) {
                    console.error({ item, current: current[k] })
                  }

                  return {
                    ...item,
                    star_count: item.star_count + current[k].star_count,
                    pull_count: item.pull_count + current[k].pull_count,
                  }
                })
              }, [])

            this.setState((state) => ({
              ...state,
              fetched: true,
              data: images,
            }))
          })
          .catch(console.error)
      })
    }
    return
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
              containerComponent={<VictoryVoronoiContainer responsive />}
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
