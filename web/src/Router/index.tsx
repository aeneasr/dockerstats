import React, { Component } from 'react'
import {
  Container,
  CssBaseline,
  Grid,
  StyledComponentProps,
  Theme,
  Typography,
  withStyles,
} from '@material-ui/core'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import NoMatch from './NoMatch'
import Statistics from '../Statistics'

const styles = (theme: Theme) => ({
  '@global': {
    body: {
      backgroundColor: '#ffffff',
    },
  },
  appBar: {
    position: 'relative' as 'relative',
  },
  toolbarTitle: {
    flex: 1,
  },
  layout: {
    width: 'auto',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 1280,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  footer: {
    marginTop: theme.spacing(8),
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: `${theme.spacing(6)}px 0`,
  },
  disclaimer: {
    marginTop: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      fontSize: 12,
    },
  },
  explanation: {
    opacity: 0.75,
  },
  title: {
    marginTop: theme.spacing(10),
    marginBottom: 32,
    cursor: 'pointer',
    color: '#01E1E1',
    fontSize: 24,
    [theme.breakpoints.down('sm')]: {
      fontSize: 24 / 1.5,
      marginBottom: 32 / 1.5,
    },
  },
})

interface PropTypes extends StyledComponentProps {}

class AppRouter extends Component<PropTypes> {
  render() {
    const { classes = {} } = this.props
    return (
      <>
        <CssBaseline />
        <Container className={classes.layout}>
          <Grid container>
            <Grid item xs={12}>
              <Typography
                component="h1"
                noWrap
                className={classes.title}
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                dockerstats.com
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Router>
                <main>
                  <Switch>
                    <Route
                      path="/hubs/docker/:org/:repo"
                      component={Statistics}
                    />
                    <Route path="/hubs/docker/:org" component={Statistics} />
                    <Route component={NoMatch} />
                  </Switch>
                </main>
              </Router>
            </Grid>

            <Grid item xs={12} className={classes.disclaimer}>
              <Typography variant="body2" className={classes.explanation}>
                Some image pull counters hit the int32 upper bound which is a
                Docker Hub bug that has been{' '}
                <a href="https://github.com/docker/hub-feedback/issues/2003">
                  reported on GitHub
                </a>
                . Dockerstats is an independent{' '}
                <a href="https://github.com/aeneasr/dockerstats">
                  research and hobby project
                </a>{' '}
                developed by <a href={'https://github.com/aeneasr'}>@aeneasr</a>
                . This project is in no way affiliated with Docker, Inc. Hosting
                sponsored by <a href={'https://www.ory.sh/'}>ORY</a>.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </>
    )
  }
}

export default withStyles(styles)(AppRouter)
