async function getUuid(url: string, revalidate: number | false) {
  const res = await fetch(url, { next: { revalidate } })
  const body: { uuid: string } = await res.json()
  return body.uuid
}

export default async function Page() {
  const forever = await getUuid('https://httpbin.org/uuid', false)
  const oneYear = await getUuid('https://httpbin.org/uuid?y', 31_536_000)

  return <pre>{JSON.stringify({ forever, oneYear }, null, 2)}</pre>
}
