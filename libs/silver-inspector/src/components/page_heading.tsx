import {ChevronLeftIcon, Home} from "lucide-react"
import {memo} from "react"
import {HStack, styled} from "../../styled-system/jsx"
import {Heading} from "./heading"
import {IconButton} from "./icon_button"

type Props = {title: string} & (
  | {
      onBack(): void
    }
  | {
      icon: React.ReactNode
    }
)

export let PageHeading = memo((props: Props) => {
  return (
    <HStack>
      {"onBack" in props ? (
        <IconButton onClick={props.onBack} variant="ghost" aria-label="Back">
          <ChevronLeftIcon />
        </IconButton>
      ) : (
        <styled.div
          width="10"
          height="10"
          fontSize="sm"
          lineHeight="1.25rem"
          display="flex"
          gap="2"
          alignItems="center"
          justifyContent="center"
        >
          {props.icon}
        </styled.div>
      )}
      <Heading>{props.title}</Heading>
    </HStack>
  )
})
