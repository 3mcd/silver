import {FlaskConical} from "lucide-react"
import {memo} from "react"
import {Page} from "../../components/page"
import {Table} from "../../components/table"
import {Type} from "../../components/type"
import {QueryDefs} from "../../context/query_context"
import {useQueries} from "../../hooks/use_queries"

type Props = {
  onQuerySelected: (query: QueryDefs[number]) => void
}

let queryRowHover = {
  color: "accent.fg",
  backgroundColor: "accent.8",
  cursor: "pointer",
}

let QueryRow = memo((props: {query: QueryDefs[number]; onClick(): void}) => {
  return (
    <Table.Row onClick={props.onClick} _hover={queryRowHover}>
      <Table.Cell>{props.query.name}</Table.Cell>
      <Table.Cell>
        <Type type={props.query.query.type} />
      </Table.Cell>
    </Table.Row>
  )
})

export let QueryList = (props: Props) => {
  let queries = useQueries()
  return (
    <Page title="Queries" icon={<FlaskConical />}>
      <Table.Root>
        <Table.Header position="sticky" top="0" background="bg.default">
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Type</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {queries.map(query => (
            <QueryRow
              key={query.name}
              query={query}
              onClick={() => props.onQuerySelected(query)}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Page>
  )
}
