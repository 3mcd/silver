import React, {PropsWithChildren, Ref, forwardRef} from "react"
import {PageHeading} from "./page_heading"
import {Stack} from "../../styled-system/jsx"

type Props = PropsWithChildren<
  {title: string; extra?: React.ReactNode} & (
    | {
        onBack(): void
      }
    | {
        icon: React.ReactNode
      }
  )
>

export let Page = forwardRef((props: Props, ref: Ref<HTMLDivElement>) => {
  return (
    <Stack height="100%" ref={ref}>
      <PageHeading {...props}>{props.extra}</PageHeading>
      {props.children}
    </Stack>
  )
})
