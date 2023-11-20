/* eslint-disable */
import type { ConditionalValue } from '../types/index';
import type { DistributiveOmit, Pretty } from '../types/system-types';

interface TableVariant {
  variant: "outline" | "plain"
size: "sm" | "md"
}

type TableVariantMap = {
  [key in keyof TableVariant]: Array<TableVariant[key]>
}

export type TableVariantProps = {
  [key in keyof TableVariant]?: ConditionalValue<TableVariant[key]>
}

export interface TableRecipe {
  __type: TableVariantProps
  (props?: TableVariantProps): Pretty<Record<"root" | "body" | "cell" | "footer" | "head" | "header" | "row" | "caption", string>>
  raw: (props?: TableVariantProps) => TableVariantProps
  variantMap: TableVariantMap
  variantKeys: Array<keyof TableVariant>
  splitVariantProps<Props extends TableVariantProps>(props: Props): [TableVariantProps, Pretty<DistributiveOmit<Props, keyof TableVariantProps>>]
}


export declare const table: TableRecipe