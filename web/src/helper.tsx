export const stats = ({ org, repo }: { org: string; repo: string }) => {
  let url = new URL(
    '/snapshots/repositories',
    `${window.location.protocol}//${window.location.host}/`
  )
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    url = new URL('/snapshots/repositories', `https://corsar.ory.sh`)
  }

  url.searchParams.set('repo', repo)
  url.searchParams.set('org', org)
  url.searchParams.set('__host', 'dockerstats.com')
  url.searchParams.set('__proto', 'https')

  return fetch(url.toString()).then((res) => res.json())
}
