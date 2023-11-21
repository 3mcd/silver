import {Aliases, aliasContext} from "./alias_context"

type Props = React.PropsWithChildren<{
  aliases?: Aliases
}>

export let AliasProvider = (props: Props) => {
  return (
    <aliasContext.Provider value={props.aliases ?? new Aliases()}>
      {props.children}
    </aliasContext.Provider>
  )
}
