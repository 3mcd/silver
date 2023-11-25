import {type HTMLArkProps} from "@ark-ui/react"
import {styled} from "../../styled-system/jsx"

export type KbdProps = HTMLArkProps<"kbd">

export let Kbd = (props: KbdProps) => {
  return (
    <styled.kbd
      alignItems="center"
      bg="bg.subtle"
      borderRadius="l2"
      boxShadow="0 -2px 0 0 inset var(--colors-border-muted) 0 0 0 1px inset var(--colors-border-muted)"
      color="fg.default"
      display="inline-flex"
      fontFamily="monospace"
      fontWeight="medium"
      padding="0 1px"
      {...props}
    />
  )
}
